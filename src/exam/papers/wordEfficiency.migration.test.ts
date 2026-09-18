import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMigrationSql } from '../../../scripts/generateWordEfficiencyMigration';
import { buildQuestion } from '@/exam/authoring';
import { draftFromRow } from '@/db/questionRow';
import type { QuestionContentRow, QuestionOperationRow, TestQuestion } from '@/db/schema';
import { markQuestion } from '@/exam/marking/markAttempt';
import { WORD_MARKER } from '@/exam/marking/wordMarker';
import { modelAnswerDocument } from '@/exam/modelAnswerDocument';
import { isWordQuestion } from '@/exam/types';
import { wordRubricFor } from '@/server/marking/rubricFromOperations';
import { WORD_EFFICIENCY_PAPERS } from './wordEfficiency';

/**
 * What the migration actually loads.
 *
 * `wordEfficiency.test.ts` marks the papers as TypeScript. This marks them as
 * *rows*: the JSON the shipped SQL inserts is pulled back out of the migration,
 * put through `draftFromRow` — the same function the exam player reads a stored
 * paper with — and marked. Between them the two tests cover the whole path a
 * question travels, and this one is the half that catches a migration that
 * stores a shape the builders cannot read.
 *
 * There is no database here, and it does not need one: what could go wrong
 * between a correct paper and a correct sitting is the *shape* of the row, and
 * the row is in the file.
 */

const MIGRATION = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../db/migrations/0016_word_efficiency_papers.sql',
);

/** Every `'...'::jsonb` literal in the file, in order, as parsed JSON. */
function jsonLiterals(sql: string): unknown[] {
  const found: unknown[] = [];
  const pattern = /'((?:[^']|'')*)'::jsonb/g;

  let match = pattern.exec(sql);
  while (match !== null) {
    found.push(JSON.parse(match[1]!.replaceAll("''", "'")));
    match = pattern.exec(sql);
  }
  return found;
}

/** The question rows the migration inserts, paired up (content, operations). */
function storedQuestions(sql: string): { content: QuestionContentRow; operations: QuestionOperationRow[] }[] {
  const literals = jsonLiterals(sql);
  const rows: { content: QuestionContentRow; operations: QuestionOperationRow[] }[] = [];

  for (let index = 0; index + 1 < literals.length; index += 2) {
    rows.push({
      content: literals[index] as QuestionContentRow,
      operations: literals[index + 1] as QuestionOperationRow[],
    });
  }
  return rows;
}

/** A stored row, as the columns `draftFromRow` reads. */
function rowFor(
  paperIndex: number,
  position: number,
  stored: { content: QuestionContentRow; operations: QuestionOperationRow[] },
): TestQuestion {
  const draft = WORD_EFFICIENCY_PAPERS[paperIndex]!.questions[position - 1]!;

  return {
    id: `00000000-0000-4000-8000-${String(position).padStart(12, '0')}`,
    testId: '00000000-0000-4000-8000-000000000000',
    position,
    subject: 'word',
    topic: draft.topic,
    difficulty: draft.difficulty,
    marks: draft.marks,
    instructionEn: draft.instruction.en,
    instructionHi: draft.instruction.hi,
    solutionEn: draft.solution.en,
    solutionHi: draft.solution.hi,
    content: stored.content,
    operations: stored.operations,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } as TestQuestion;
}

const sql = readFileSync(MIGRATION, 'utf8');
const rows = storedQuestions(sql);

describe('the Word efficiency migration', () => {
  it('is what the generator produces from the papers', () => {
    // The papers are the tested artefact; the SQL is a copy of them. If this
    // fails, someone edited one of the two without the other — regenerate with
    // `npx tsx scripts/generateWordEfficiencyMigration.ts`.
    expect(sql).toBe(buildMigrationSql());
  });

  it('publishes both papers, so a candidate can actually open them', () => {
    // A draft paper is invisible to `todaysTest` and to the mock list, which
    // would make the whole migration a no-op from the candidate's side.
    const insert = sql.slice(sql.indexOf('INSERT INTO tests'), sql.indexOf('ON CONFLICT'));

    for (const paper of WORD_EFFICIENCY_PAPERS) {
      expect(insert).toContain(`'${paper.slug}'`);
    }
    expect(insert.match(/'published'/g)).toHaveLength(WORD_EFFICIENCY_PAPERS.length);
  });

  it('hangs the papers off a published exam', () => {
    // Which exam a paper belongs to is what the mock list labels it with, so an
    // archived or draft exam is the wrong home while a live one exists — and the
    // exam created on an empty database has to be published itself, or the
    // papers arrive under an exam nobody can see.
    expect(sql).toMatch(/ORDER BY \(status <> 'published'\), created_at ASC/);
    expect(sql.slice(sql.indexOf('INSERT INTO exams'), sql.indexOf('WITH host_exam'))).toContain("'published'");
  });

  it('inserts one question row per question', () => {
    const total = WORD_EFFICIENCY_PAPERS.reduce((sum, paper) => sum + paper.questions.length, 0);
    expect(rows).toHaveLength(total);
  });

  it.each(
    WORD_EFFICIENCY_PAPERS.flatMap((paper, paperIndex) =>
      paper.questions.map((draft) => ({
        title: `${paper.name} · question ${draft.number}`,
        paperIndex,
        position: draft.number,
      })),
    ),
  )('$title: the stored row marks its own worked answer correct', ({ paperIndex, position }) => {
    // The row is read exactly as the player reads it — same function, same
    // casts — and then marked by the key derived from the row's own operations.
    const offset = WORD_EFFICIENCY_PAPERS.slice(0, paperIndex).reduce(
      (sum, paper) => sum + paper.questions.length,
      0,
    );
    const stored = rows[offset + position - 1]!;
    const draft = draftFromRow(rowFor(paperIndex, position, stored));

    const question = buildQuestion(draft);
    if (!isWordQuestion(question)) throw new Error('the stored row is not a Word question');

    const marked = markQuestion(
      question,
      wordRubricFor(draft as never),
      modelAnswerDocument(question, 'hi'),
      WORD_MARKER,
      'hi',
    );

    expect(marked.criteria.filter((criterion) => !criterion.passed)).toEqual([]);
    expect(marked.outcome).toBe('correct');

    /*
     * And the half that catches a row which lost something on the way into the
     * database. A question whose starting formatting was dropped — "remove the
     * highlight" on a passage that was never highlighted — marks its worked
     * answer correct *and* marks doing nothing correct, so only this assertion
     * would notice.
     */
    const untouched = markQuestion(question, wordRubricFor(draft as never), question.passage.hi, WORD_MARKER, 'hi');
    expect(untouched.outcome).toBe('incorrect');
  });
});
