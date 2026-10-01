import { normaliseWorkbook, projectWorkbook } from '@/exam/workbook/apply';
import { isWorkbookSnapshot } from '@/exam/workbook/record';
import { SnapshotTooLargeError, type WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import type { ParseResult } from './testInput';

/**
 * What the single-workbook authoring screen sends besides a question's wording
 * (which `parseDocumentQuestionFields` handles for both flows).
 */

/** A workbook snapshot of an exam sheet is a few kilobytes; this is generous. */
export const MAX_WORKBOOK_BYTES = 1024 * 1024;
export const MAX_WORKBOOK_QUESTIONS = 100;

function fail<T>(code: string, detail: string): ParseResult<T> {
  return { ok: false, code, detail };
}

/** A workbook sent by the spreadsheet, checked for shape and size. Not normalised. */
export function parseEditorWorkbook(value: unknown): ParseResult<WorkbookSnapshot> {
  if (!isWorkbookSnapshot(value)) {
    return fail('INVALID_WORKBOOK', 'The workbook is missing or is not a spreadsheet workbook.');
  }
  if (JSON.stringify(value).length > MAX_WORKBOOK_BYTES) {
    return fail('WORKBOOK_TOO_LARGE', 'The workbook is too large. Reduce the sheet.');
  }
  return { ok: true, fields: value };
}

/** The starting workbook as it is stored: checked, normalised, and not empty. */
export function parseStartingWorkbook(value: unknown): ParseResult<WorkbookSnapshot> {
  const parsed = parseEditorWorkbook(value);
  if (!parsed.ok) return parsed;

  let workbook: WorkbookSnapshot;
  try {
    workbook = normaliseWorkbook(parsed.fields);
  } catch (error) {
    if (error instanceof SnapshotTooLargeError) return fail('WORKBOOK_TOO_LARGE', error.message);
    throw error;
  }

  if ((projectWorkbook(workbook).sheets[0]?.cells.size ?? 0) === 0) {
    return fail('WORKBOOK_REQUIRED', 'Enter the sheet’s data before saving it.');
  }
  return { ok: true, fields: workbook };
}
