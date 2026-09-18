/**
 * Re-marks stored sittings against the paper as it stands today.
 *
 *     npx tsx --conditions react-server scripts/remarkAttempts.ts [--write]
 *
 * A sitting is normally marked once, when it is submitted, and left alone: the
 * score a candidate got is the score they got. This exists for the other case —
 * a paper edited after someone sat it, which is the state a paper under
 * development is in most of the time. The old score was out of a total the
 * paper no longer has, and the dashboard would keep quoting it.
 *
 * It re-marks rather than rescales. The attempt row stores the answers that
 * were actually submitted, so this runs them through the same marking the
 * submit route runs and writes back what they are worth now. Nothing is
 * invented; a candidate who left a question blank still gets nothing for it.
 *
 * Without `--write` it only reports what would change.
 *
 * `--conditions react-server` is what lets a script import the `server-only`
 * modules the marking lives in.
 */

import { readFileSync } from 'node:fs';
import pg from 'pg';
import { markAttempt } from '../src/exam/marking/markAttempt';
import { WORD_MARKER } from '../src/exam/marking/wordMarker';
import { SHEET_MARKER } from '../src/exam/marking/sheet/sheetMarker';
import { buildAttempt } from '../src/exam/authoring';
import { draftFromRow } from '../src/db/questionRow';
import { excelRubricFor, wordRubricFor } from '../src/server/marking/rubricFromOperations';
import type { TestQuestion } from '../src/db/schema';
import type { AnswerPayload, Language } from '../src/exam/types';

const write = process.argv.includes('--write');

function readEnv(): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    const name = match?.[1];
    const value = match?.[2];
    if (name && value !== undefined) values[name] = value.replace(/^['"]|['"]$/g, '');
  }

  return values;
}

const env = readEnv();

/** Zeroed: the comparison lines are not what this recomputes. */
const EMPTY_LINE = { score: 0, maxScore: 0, accuracy: 0, correct: 0, wrong: 0, unattempted: 0, timeSeconds: 0 };

const client = new pg.Client({
  connectionString: env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

await client.connect();

const { rows: attempts } = await client.query(`
  SELECT a.id, a.test_id, a.language, a.score, a.max_score, a.answers, a.result,
         t.slug, t.name, t.subject, t.section_name, t.tagline, t.duration_minutes, t.qualifying_marks
  FROM test_attempts a
  JOIN tests t ON t.id = a.test_id
  ORDER BY a.submitted_at
`);

for (const attempt of attempts) {
  const { rows: questionRows } = await client.query(
    'SELECT * FROM test_questions WHERE test_id = $1 ORDER BY position',
    [attempt.test_id],
  );

  const drafts = questionRows
    .map((row) => ({
      id: row.id,
      testId: row.test_id,
      position: row.position,
      subject: row.subject,
      topic: row.topic,
      difficulty: row.difficulty,
      marks: row.marks,
      instructionEn: row.instruction_en,
      instructionHi: row.instruction_hi,
      solutionEn: row.solution_en,
      solutionHi: row.solution_hi,
      content: row.content,
      operations: row.operations,
    }))
    .map((row) => draftFromRow(row as unknown as TestQuestion));

  if (drafts.length === 0) continue;

  const paper = buildAttempt({
    candidateName: 'Candidate',
    subject: attempt.subject,
    sectionName: attempt.section_name,
    durationSeconds: attempt.duration_minutes * 60,
    questions: drafts,
  });

  const answers = (attempt.answers ?? {}) as Record<number, AnswerPayload>;
  const previous = attempt.result as { you?: { timeSeconds?: number } } | null;

  const marked =
    attempt.subject === 'word'
      ? markAttempt(
          paper,
          drafts.map((draft) => wordRubricFor(draft as never)),
          {
            answers,
            language: attempt.language as Language,
            totalTimeSeconds: previous?.you?.timeSeconds ?? 0,
          },
          { topper: EMPTY_LINE, average: EMPTY_LINE, topperTimePerQuestion: [], averageTimePerQuestion: [] },
          WORD_MARKER,
          {
            testName: attempt.name,
            tagline: attempt.tagline ?? '',
            qualifyingMarks: attempt.qualifying_marks,
          },
        )
      : markAttempt(
          paper,
          drafts.map((draft) => excelRubricFor(draft as never)),
          {
            answers,
            language: attempt.language as Language,
            totalTimeSeconds: previous?.you?.timeSeconds ?? 0,
          },
          { topper: EMPTY_LINE, average: EMPTY_LINE, topperTimePerQuestion: [], averageTimePerQuestion: [] },
          SHEET_MARKER,
          {
            testName: attempt.name,
            tagline: attempt.tagline ?? '',
            qualifyingMarks: attempt.qualifying_marks,
          },
        );

  const before = `${attempt.score} / ${attempt.max_score}`;
  const after = `${marked.result.you.score} / ${marked.result.maximumMarks}`;
  if (before === after) {
    process.stdout.write(`${attempt.slug}: ${before} — unchanged\n`);
    continue;
  }

  process.stdout.write(`${attempt.slug}: ${before} -> ${after}${write ? '' : ' (dry run)'}\n`);

  if (write) {
    await client.query(
      'UPDATE test_attempts SET score = $1, max_score = $2, accuracy_pct = $3, result = $4, updated_at = now() WHERE id = $5',
      [
        marked.result.you.score,
        marked.result.maximumMarks,
        marked.result.you.accuracy,
        JSON.stringify(marked.result),
        attempt.id,
      ],
    );
  }
}

await client.end();
process.stdout.write(write ? 'written\n' : 'nothing written — pass --write to apply\n');
