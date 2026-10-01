import { cellKey, MAX_COLUMNS, MAX_ROWS, type RangeAddress } from '@/spreadsheet/model/address';
import { MAX_SNAPSHOT_CELLS, type WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import { faithfulWorkbook, projectWorkbook } from './apply';
import { describeCells } from './describe';
import { detectWorkbookChanges } from './detect';
import type { CellRef, WorkbookStep } from './types';

/**
 * The rules for turning a before and an after workbook into a stored question,
 * and for accepting a candidate's timeline. The counterpart of
 * `src/exam/document/record.ts`; both run on the server against workbooks it
 * holds or has just been sent.
 */

export const MAX_WORKBOOK_STEPS = 60;
/** A sitting is a few dozen visits; this bounds what one submission makes the server project. */
export const MAX_WORKBOOK_TIMELINE_ENTRIES = 400;
const MAX_SHEETS = 20;

export type WorkbookRecordResult = { ok: true; steps: WorkbookStep[] } | { ok: false; code: string; detail: string };

/** What the admin did between `before` and `after`, if it can be a question. */
export function recordWorkbookQuestion(before: WorkbookSnapshot, after: WorkbookSnapshot): WorkbookRecordResult {
  const detection = detectWorkbookChanges(projectWorkbook(before), projectWorkbook(after));

  if (detection.problems.length > 0) {
    return { ok: false, code: 'NOT_RECORDABLE', detail: detection.problems.join(' ') };
  }
  if (detection.steps.length === 0) {
    return {
      ok: false,
      code: 'NOTHING_DETECTED',
      detail: 'No change was detected. Perform the question’s operation on the sheet, then save.',
    };
  }
  if (detection.steps.length > MAX_WORKBOOK_STEPS) {
    return {
      ok: false,
      code: 'TOO_MANY_CHANGES',
      detail: `That is ${detection.steps.length} separate changes. A question may make at most ${MAX_WORKBOOK_STEPS} — split it into several questions.`,
    };
  }
  if (!faithfulWorkbook(before, detection.steps, after)) {
    return {
      ok: false,
      code: 'NOT_REPLAYABLE',
      detail: 'Part of this change cannot be recorded faithfully. Undo it and use a different operation.',
    };
  }

  return { ok: true, steps: detection.steps };
}

/* -- Shape checks ------------------------------------------------------------ */

function isIndex(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < max;
}

function isRange(value: unknown): value is RangeAddress {
  if (!value || typeof value !== 'object') return false;
  const { start, end } = value as RangeAddress;
  return (
    Boolean(start) &&
    Boolean(end) &&
    isIndex(start.row, MAX_ROWS) &&
    isIndex(start.col, MAX_COLUMNS) &&
    isIndex(end.row, MAX_ROWS) &&
    isIndex(end.col, MAX_COLUMNS)
  );
}

function isCellValue(value: unknown): boolean {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

/**
 * Whether a value from a request has the shape of a `WorkbookSnapshot`.
 *
 * `workbookFromSnapshot` trusts its input, so anything sent by a browser is
 * checked here first: sheets, cells within the grid, values of a cell's kinds,
 * and no more cells than `snapshotWorkbook` itself would produce.
 */
export function isWorkbookSnapshot(value: unknown): value is WorkbookSnapshot {
  if (!value || typeof value !== 'object') return false;
  const { sheets } = value as WorkbookSnapshot;
  if (!Array.isArray(sheets) || sheets.length === 0 || sheets.length > MAX_SHEETS) return false;

  let total = 0;
  for (const sheet of sheets) {
    if (!sheet || typeof sheet !== 'object' || typeof sheet.name !== 'string' || sheet.name.length > 100) return false;
    if (!Array.isArray(sheet.cells) || !Array.isArray(sheet.rows) || !Array.isArray(sheet.columns)) return false;
    if (!Array.isArray(sheet.merges) || !sheet.merges.every(isRange)) return false;
    if (!sheet.frozen || !isIndex(sheet.frozen.rows, MAX_ROWS) || !isIndex(sheet.frozen.columns, MAX_COLUMNS)) return false;
    if (!sheet.view || typeof sheet.view !== 'object') return false;
    if (sheet.printArea !== null && !isRange(sheet.printArea)) return false;

    total += sheet.cells.length;
    if (total > MAX_SNAPSHOT_CELLS) return false;
    for (const cell of sheet.cells) {
      if (!cell || !isIndex(cell.row, MAX_ROWS) || !isIndex(cell.col, MAX_COLUMNS) || !isCellValue(cell.value)) return false;
      if (cell.formula !== undefined && (typeof cell.formula !== 'string' || cell.formula.length > 8_000)) return false;
      if (cell.style !== undefined && (typeof cell.style !== 'object' || cell.style === null)) return false;
    }
    for (const entry of [...sheet.rows, ...sheet.columns]) {
      if (!Array.isArray(entry) || !isIndex(entry[0], Math.max(MAX_ROWS, MAX_COLUMNS)) || typeof entry[1] !== 'object') {
        return false;
      }
    }
  }
  return true;
}

/** A submitted timeline of workbooks, or null when it is not one. */
export function parseWorkbookTimeline(value: unknown): { question: number; document: WorkbookSnapshot }[] | null {
  if (!Array.isArray(value) || value.length > MAX_WORKBOOK_TIMELINE_ENTRIES) return null;

  const entries: { question: number; document: WorkbookSnapshot }[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const { question, document } = raw as { question?: unknown; document?: unknown };
    if (typeof question !== 'number' || !Number.isInteger(question) || question < 1) return null;
    if (!isWorkbookSnapshot(document)) return null;
    entries.push({ question, document });
  }
  return entries;
}

/* -- Questions that collide ------------------------------------------------ */

function footprint(step: WorkbookStep): string[] {
  switch (step.kind) {
    case 'content':
      return step.cells.map((cell) => `content:${cellKey(cell.row, cell.col)}`);
    case 'style':
      return step.cells.map((cell) => `${step.property}:${cellKey(cell.row, cell.col)}`);
    case 'merge':
      return [`merge:${step.range.start.row}:${step.range.start.col}`];
    case 'column':
      return [`column:${step.col}`];
    case 'row':
      return [`row:${step.row}`];
    default:
      return [step.kind];
  }
}

function cellsOf(step: WorkbookStep): CellRef[] {
  return step.kind === 'content' || step.kind === 'style' ? step.cells : [];
}

/**
 * Questions that change the same thing in the same place.
 *
 * As for Word: each question is marked only on what changed while it was open,
 * so two that set the same cell cannot both show a change in every order. A
 * warning, not a refusal — the admin decides whether it was meant.
 */
export function workbookOverlapWarnings(
  steps: readonly WorkbookStep[],
  others: readonly { number: number; steps: readonly WorkbookStep[] }[],
): string[] {
  const mine = new Set(steps.flatMap(footprint));
  const warnings: string[] = [];

  for (const other of others) {
    const clash = other.steps.find((step) => footprint(step).some((entry) => mine.has(entry)));
    if (!clash) continue;
    const where = cellsOf(clash).length > 0 ? ` on ${describeCells(cellsOf(clash))}` : '';
    warnings.push(
      `Changes the same thing${where} as question ${other.number}. A candidate who answers question ${other.number} after this one may find nothing left to change.`,
    );
  }
  return warnings;
}
