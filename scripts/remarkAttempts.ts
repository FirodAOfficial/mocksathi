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
 * Everything that is not a score is carried across untouched — how long the
 * candidate spent on each question above all, since that is stored only inside
 * the result being replaced and cannot be recomputed from anything else.
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
import {
  REFERENCE_AVERAGE,
  REFERENCE_AVERAGE_TIMES,
  REFERENCE_TOPPER,
  REFERENCE_TOPPER_TIMES,
} from '../src/exam/result';
import type { AnswerPayload, Language } from '../src/exam/types';

const write = process.argv.includes('--write');

/**
 * Which papers to touch: `--slug=<slug>`, repeatable.
 *
 * A re-mark rewrites a stored result, so it defaults to reporting on
 * everything and changing one named thing at a time.
 */
const slugs = process.argv
  .filter((argument) => argument.startsWith('--slug='))
  .map((argument) => argument.slice('--slug='.length));

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

/**
 * JSON with its keys in a fixed order, for comparing a stored result with a
 * freshly computed one.
 *
 * Postgres `jsonb` does not keep the key order it was given — it stores keys
 * sorted — so a plain `JSON.stringify` of each side differs on every row, and a
 * comparison built on that would report every attempt as changed and rewrite
 * all of them.
 */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) => {
    if (nested === null || typeof nested !== 'object' || Array.isArray(nested)) return nested;

    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(nested as Record<string, unknown>).sort()) {
      sorted[key] = (nested as Record<string, unknown>)[key];
    }
    return sorted;
  });
}

/**
 * The same reference lines the submit route marks against.
 *
 * Not zeroes. Re-marking recomputes the *score*; everything else in a stored
 * result has to come out the way it went in, or the result screen loses the
 * comparison the chart is drawn from — which is what a first version of this
 * script did, silently.
 */
const REFERENCE = {
  topper: REFERENCE_TOPPER,
  average: REFERENCE_AVERAGE,
  topperTimePerQuestion: [...REFERENCE_TOPPER_TIMES],
  averageTimePerQuestion: [...REFERENCE_AVERAGE_TIMES],
};

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
  const previous = attempt.result as {
    you?: { timeSeconds?: number };
    questions?: { number: number; yourTimeSeconds?: number }[];
  } | null;

  /*
   * How long the candidate spent on each question, recovered from the result
   * being replaced.
   *
   * The submission's own per-question timings are not stored anywhere else —
   * only inside this result — so a re-mark that did not carry them forward
   * would erase them. It is the one part of a sitting that cannot be
   * recomputed from the answers.
   */
  const timePerQuestion: Record<number, number> = {};
  for (const question of previous?.questions ?? []) {
    if (question.yourTimeSeconds) timePerQuestion[question.number] = question.yourTimeSeconds;
  }

  const marked =
    attempt.subject === 'word'
      ? markAttempt(
          paper,
          drafts.map((draft) => wordRubricFor(draft as never)),
          {
            answers,
            language: attempt.language as Language,
            timePerQuestion,
            totalTimeSeconds: previous?.you?.timeSeconds ?? 0,
          },
          REFERENCE,
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
            timePerQuestion,
            totalTimeSeconds: previous?.you?.timeSeconds ?? 0,
          },
          REFERENCE,
          SHEET_MARKER,
          {
            testName: attempt.name,
            tagline: attempt.tagline ?? '',
            qualifyingMarks: attempt.qualifying_marks,
          },
        );

  const before = `${attempt.score} / ${attempt.max_score}`;
  const after = `${marked.result.you.score} / ${marked.result.maximumMarks}`;

  /*
   * The whole result is compared, not just the score.
   *
   * A stored result can be wrong in ways the score does not show — the
   * comparison lines the time chart is drawn from, or feedback whose wording
   * has since changed — and a run that only looked at the score would report
   * "unchanged" over a result that is visibly broken on the review screen.
   */
  const changed = stable(attempt.result) !== stable(marked.result);
  if (!changed) {
    process.stdout.write(`${attempt.slug}: ${before} — unchanged\n`);
    continue;
  }

  const selected = slugs.length === 0 || slugs.includes(String(attempt.slug));
  const what = before === after ? `${before}, details only` : `${before} -> ${after}`;
  const note = !write ? ' (dry run)' : selected ? '' : ' (not selected)';
  process.stdout.write(`${attempt.slug}: ${what}${note}\n`);

  if (write && selected) {
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
