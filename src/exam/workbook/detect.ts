import { cellKey, keyToAddress, type RangeAddress } from '@/spreadsheet/model/address';
import { DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT } from '@/spreadsheet/model/Worksheet';
import type { FlatCell, FlatSheet, FlatWorkbook } from '@/exam/marking/sheet/flattenWorkbook';
import type { CellRef, ContentChange, StyleChange, StyleProperty, WorkbookStep } from './types';

/**
 * Reading what someone did to a workbook from a before and an after.
 *
 * The spreadsheet half of "identify the operation": the admin performs a
 * question in the spreadsheet and this works out what it was — which cells got
 * which values or formulas, which formatting, what was merged, which column was
 * widened. It runs on the marking projection (`flattenWorkbook`), so a
 * difference here is a difference marking would see, and none of the many
 * equivalent ways of storing the same look counts as a change.
 *
 * One rule matters more than the rest: **a formula whose text did not change
 * did not change**, whatever its value now is. Typing 500 into B3 recalculates
 * the SUM in B8, and that is the spreadsheet working, not a second thing the
 * admin did — a question recorded with it would demand the total the admin's
 * sheet happened to have, which another order of answering would never reach.
 */

/** Every style property marking compares. Typed against `StyleProperty`, so a new one cannot be missed. */
export const STYLE_PROPERTIES = [
  'fontFamily',
  'fontSize',
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'fontColor',
  'fillColor',
  'horizontalAlignment',
  'verticalAlignment',
  'wrapText',
  'textEffect',
  'textRotation',
  'indent',
  'borders',
  'numberFormat',
] as const satisfies readonly StyleProperty[];

type UnlistedStyleProperty = Exclude<StyleProperty, (typeof STYLE_PROPERTIES)[number]>;
const EVERY_STYLE_PROPERTY_IS_LISTED: [UnlistedStyleProperty] extends [never] ? true : UnlistedStyleProperty = true;
void EVERY_STYLE_PROPERTY_IS_LISTED;

export interface WorkbookDetection {
  steps: WorkbookStep[];
  /** Why this cannot be stored as a question. Non-empty means refuse. */
  problems: string[];
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** A formula with its text unchanged is not a change, whatever it now evaluates to. */
function contentChanged(before: FlatCell | undefined, after: FlatCell | undefined): boolean {
  const beforeFormula = before?.formula ?? null;
  const afterFormula = after?.formula ?? null;
  if (beforeFormula !== null && beforeFormula === afterFormula) return false;
  if (beforeFormula !== afterFormula) return true;
  return (before?.value ?? null) !== (after?.value ?? null);
}

function styleValue(cell: FlatCell | undefined, property: StyleProperty): unknown {
  const value = cell?.style[property];
  return value === undefined ? null : value;
}

/** Everything about a sheet that marking looks at, as one comparable string. */
function sheetSignature(sheet: FlatSheet): string {
  return JSON.stringify({
    cells: [...sheet.cells.entries()].sort(([a], [b]) => a - b),
    rows: [...sheet.rows.entries()].sort(([a], [b]) => a - b),
    columns: [...sheet.columns.entries()].sort(([a], [b]) => a - b),
    merges: sheet.merges,
    frozen: sheet.frozen,
    view: sheet.view,
    printArea: sheet.printArea,
  });
}

function structuralProblems(before: FlatWorkbook, after: FlatWorkbook): string[] {
  const names = (workbook: FlatWorkbook) => workbook.sheets.map((sheet) => sheet.name).join('\u0000');
  if (before.sheets.length !== after.sheets.length || names(before) !== names(after)) {
    return ['Sheets were added, removed or renamed. Questions may only change the cells of the first sheet.'];
  }

  for (let index = 1; index < after.sheets.length; index += 1) {
    if (sheetSignature(before.sheets[index]!) !== sheetSignature(after.sheets[index]!)) {
      return [
        `The sheet "${after.sheets[index]!.name}" was changed. Only the first sheet is marked — make the change there.`,
      ];
    }
  }

  return [];
}

function contentStep(before: FlatSheet, after: FlatSheet, keys: number[]): WorkbookStep | null {
  const cells: ContentChange[] = [];
  for (const key of keys) {
    const was = before.cells.get(key);
    const now = after.cells.get(key);
    if (!contentChanged(was, now)) continue;
    const { row, col } = keyToAddress(key);
    cells.push({
      row,
      col,
      value: now?.value ?? null,
      ...(now?.formula === undefined ? {} : { formula: now.formula }),
      previous: was?.value ?? null,
      ...(was?.formula === undefined ? {} : { previousFormula: was.formula }),
    });
  }
  return cells.length > 0 ? { kind: 'content', cells } : null;
}

function bounds(cells: readonly CellRef[]): RangeAddress {
  const rows = cells.map((cell) => cell.row);
  const cols = cells.map((cell) => cell.col);
  return {
    start: { row: Math.min(...rows), col: Math.min(...cols) },
    end: { row: Math.max(...rows), col: Math.max(...cols) },
  };
}

function styleSteps(before: FlatSheet, after: FlatSheet, keys: number[]): WorkbookStep[] {
  const steps: WorkbookStep[] = [];

  for (const property of STYLE_PROPERTIES) {
    // Grouped by the value set, so "fill A1:D1 yellow and E1 green" is two
    // steps. Borders are the exception: Outside Borders gives each edge cell a
    // different set of edges, and that is still one operation.
    const groups = new Map<string, StyleChange[]>();

    for (const key of keys) {
      const was = styleValue(before.cells.get(key), property);
      const now = styleValue(after.cells.get(key), property);
      if (sameValue(was, now)) continue;
      const { row, col } = keyToAddress(key);
      const group = property === 'borders' ? '' : JSON.stringify(now);
      groups.set(group, [...(groups.get(group) ?? []), { row, col, value: now, previous: was }]);
    }

    for (const cells of groups.values()) {
      cells.sort((a, b) => a.row - b.row || a.col - b.col);
      const value = cells[0]!.value;
      const licence: CellRef[] = [];

      if (property !== 'borders' && value !== null) {
        const area = bounds(cells);
        const changed = new Set(cells.map((cell) => cellKey(cell.row, cell.col)));
        for (let row = area.start.row; row <= area.end.row; row += 1) {
          for (let col = area.start.col; col <= area.end.col; col += 1) {
            const key = cellKey(row, col);
            if (changed.has(key)) continue;
            if (sameValue(styleValue(after.cells.get(key), property), value)) licence.push({ row, col });
          }
        }
      }

      steps.push({ kind: 'style', property, cells, licence });
    }
  }

  return steps;
}

function sameRange(a: RangeAddress, b: RangeAddress): boolean {
  return a.start.row === b.start.row && a.start.col === b.start.col && a.end.row === b.end.row && a.end.col === b.end.col;
}

function mergeSteps(before: FlatSheet, after: FlatSheet): WorkbookStep[] {
  const added = after.merges.filter((merge) => !before.merges.some((other) => sameRange(merge, other)));
  const removed = before.merges.filter((merge) => !after.merges.some((other) => sameRange(merge, other)));
  return [
    ...added.map((range): WorkbookStep => ({ kind: 'merge', range, merged: true })),
    ...removed.map((range): WorkbookStep => ({ kind: 'merge', range, merged: false })),
  ];
}

function lineSteps(before: FlatSheet, after: FlatSheet): WorkbookStep[] {
  const steps: WorkbookStep[] = [];

  for (const col of [...new Set([...before.columns.keys(), ...after.columns.keys()])].sort((a, b) => a - b)) {
    const was = before.columns.get(col);
    const now = after.columns.get(col);
    const width = { from: was?.width ?? DEFAULT_COLUMN_WIDTH, to: now?.width ?? DEFAULT_COLUMN_WIDTH };
    const hidden = { from: Boolean(was?.hidden), to: Boolean(now?.hidden) };
    if (width.from === width.to && hidden.from === hidden.to) continue;
    steps.push({
      kind: 'column',
      col,
      ...(width.from === width.to ? {} : { width }),
      ...(hidden.from === hidden.to ? {} : { hidden }),
    });
  }

  for (const row of [...new Set([...before.rows.keys(), ...after.rows.keys()])].sort((a, b) => a - b)) {
    const was = before.rows.get(row);
    const now = after.rows.get(row);
    const height = { from: was?.height ?? DEFAULT_ROW_HEIGHT, to: now?.height ?? DEFAULT_ROW_HEIGHT };
    const hidden = { from: Boolean(was?.hidden), to: Boolean(now?.hidden) };
    if (height.from === height.to && hidden.from === hidden.to) continue;
    steps.push({
      kind: 'row',
      row,
      ...(height.from === height.to ? {} : { height }),
      ...(hidden.from === hidden.to ? {} : { hidden }),
    });
  }

  return steps;
}

function sheetSteps(before: FlatSheet, after: FlatSheet): WorkbookStep[] {
  const steps: WorkbookStep[] = [];

  if (before.frozen.rows !== after.frozen.rows || before.frozen.columns !== after.frozen.columns) {
    steps.push({ kind: 'freeze', rows: after.frozen.rows, columns: after.frozen.columns, previous: { ...before.frozen } });
  }

  const gridlines = before.view.showGridlines !== after.view.showGridlines;
  const headings = before.view.showHeadings !== after.view.showHeadings;
  if (gridlines || headings) {
    steps.push({
      kind: 'view',
      ...(gridlines ? { showGridlines: after.view.showGridlines } : {}),
      ...(headings ? { showHeadings: after.view.showHeadings } : {}),
    });
  }

  const wasArea = before.printArea;
  const nowArea = after.printArea;
  if ((wasArea === null) !== (nowArea === null) || (wasArea && nowArea && !sameRange(wasArea, nowArea))) {
    steps.push({ kind: 'printArea', range: nowArea, previous: wasArea });
  }

  return steps;
}

/** What changed between two projections of the same workbook. */
export function detectWorkbookChanges(before: FlatWorkbook, after: FlatWorkbook): WorkbookDetection {
  const problems = structuralProblems(before, after);
  if (problems.length > 0) return { steps: [], problems };

  const was = before.sheets[0];
  const now = after.sheets[0];
  if (!was || !now) return { steps: [], problems: ['The workbook has no sheet.'] };

  const keys = [...new Set([...was.cells.keys(), ...now.cells.keys()])].sort((a, b) => a - b);
  const content = contentStep(was, now, keys);

  return {
    steps: [
      ...(content ? [content] : []),
      ...styleSteps(was, now, keys),
      ...mergeSteps(was, now),
      ...lineSteps(was, now),
      ...sheetSteps(was, now),
    ],
    problems,
  };
}
