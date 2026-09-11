import { eachAddress } from '@/spreadsheet/model/address';
import { snapshotWorkbook, workbookFromSnapshot, type WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import type { ExcelQuestion, Language, WorkbookAnswer } from './types';

/**
 * The workbook as it looks once the question is answered correctly.
 *
 * Built by applying the model answer to the workbook the candidate started
 * from, rather than by storing a second copy of it — the same choice
 * `modelAnswerDocument` makes for Word passages. A stored copy would drift from
 * the data the candidate was given, and the review screen would then show a
 * worked answer to a different question.
 *
 * Safe to run in the browser: the instruction already says what to do. What
 * counts as correct is still decided server-side, against the answer key.
 */
export function modelWorkbookSnapshot(question: ExcelQuestion, language: Language): WorkbookSnapshot {
  return applyWorkbookAnswer(question.workbook[language], question.modelAnswer);
}

export function applyWorkbookAnswer(
  start: WorkbookSnapshot,
  answer: WorkbookAnswer,
): WorkbookSnapshot {
  const workbook = workbookFromSnapshot(start);
  const sheet = workbook.activeSheet();
  if (!sheet) return start;

  for (const { row, col, value, formula } of answer.cells ?? []) {
    const existing = sheet.getCell(row, col);
    sheet.setCell(row, col, {
      value: value ?? existing?.value ?? null,
      ...(formula === undefined ? {} : { formula }),
      styleId: existing?.styleId ?? 0,
    });
  }

  for (const { range, style } of answer.styles ?? []) {
    for (const { row, col } of eachAddress(range)) {
      const existing = sheet.getCell(row, col);
      sheet.setCell(row, col, {
        value: existing?.value ?? null,
        ...existing,
        styleId: workbook.styles.derive(existing?.styleId ?? 0, style),
      });
    }
  }

  for (const [col, props] of answer.columns ?? []) sheet.setColumnProps(col, { ...props });
  for (const range of answer.merges ?? []) sheet.mergeCells(range);
  if (answer.frozen) sheet.freeze(answer.frozen.rows, answer.frozen.columns);
  if (answer.view) sheet.view = { ...sheet.view, ...answer.view };
  if (answer.printArea !== undefined) {
    sheet.printArea = answer.printArea
      ? { start: { ...answer.printArea.start }, end: { ...answer.printArea.end } }
      : null;
  }

  return snapshotWorkbook(workbook);
}
