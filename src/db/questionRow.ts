import {
  workbookFromGrid,
  type ExcelOperation,
  type QuestionDraft,
  type WordOperation,
} from '@/exam/authoring';
import type { ExcelContentRow, TestQuestion, WordContentRow } from './schema';

/**
 * A stored question row as an authoring draft.
 *
 * Split out of `tests.ts` so it can be tested: that module is `server-only` and
 * opens a database connection on import, and this is a pure mapping — the one
 * place where what a migration wrote becomes what the builders and the marker
 * read. `wordEfficiency.migration.test.ts` runs the shipped migration's own
 * rows through it and marks the result, which is the only way to know the SQL
 * and the papers still agree.
 */

/**
 * One stored question as an authoring draft.
 *
 * The casts are the reconciliation the schema's `jsonb` types stand in for.
 * They are safe in one direction only: everything written through
 * `parseQuestionInput` was rebuilt from the closed vocabulary in
 * `testInput.ts`, so a row cannot hold an operation the builders do not know.
 * A row written by hand, or by a future migration, is not covered — which is
 * exactly why the write path validates rather than trusting its caller.
 */
export function draftFromRow(row: TestQuestion): QuestionDraft {
  const base = {
    number: row.position,
    topic: row.topic,
    difficulty: row.difficulty,
    instruction: { en: row.instructionEn, hi: row.instructionHi },
    solution: { en: row.solutionEn, hi: row.solutionHi },
    marks: row.marks,
  };

  if (row.subject === 'word') {
    const content = row.content as WordContentRow;
    return {
      ...base,
      subject: 'word',
      lines: content.lines,
      scope: content.scope,
      operations: row.operations as WordOperation[],
      // A question that asks for more than one thing stores its steps beside
      // the passage; `stepsOf` reads either shape, so everything downstream is
      // unaware of which one was written.
      ...(content.steps
        ? { steps: content.steps.map((step) => ({ scope: step.scope, operations: step.operations as WordOperation[] })) }
        : {}),
      // Formatting the passage starts with. Without it a question that asks for
      // a highlight to be removed would open on a passage that never had one,
      // and pass for a candidate who did nothing at all.
      ...(content.initial
        ? {
            initial: content.initial.map((step) => ({
              scope: step.scope,
              operations: step.operations as WordOperation[],
            })),
          }
        : {}),
    };
  }

  const content = row.content as ExcelContentRow;
  return {
    ...base,
    subject: 'excel',
    // The grid is stored, the workbook is built — so an edit to the sheet is
    // an edit to cells an admin can still see, not to a snapshot no form can
    // open again.
    workbook: workbookFromGrid(content.grid, content.startingView),
    operations: row.operations as ExcelOperation[],
  };
}
