import type { RangeAddress } from './address';
import type { Cell, CellValue } from './Cell';
import type { CellStyle } from './styles';
import { DEFAULT_STYLE_ID } from './styles';
import { Workbook } from './Workbook';
import {
  DEFAULT_SHEET_VIEW,
  Worksheet,
  type ColumnProps,
  type FrozenPanes,
  type RowProps,
  type SheetView,
} from './Worksheet';

/**
 * A workbook as plain, serialisable data.
 *
 * This is what a candidate's answer *is*: the sheet they ended up with, sent to
 * the server for marking, exactly as the Word paper sends the document it ended
 * up with. It is not a save file — nothing here is persisted, and the snapshot
 * exists only for the length of one request.
 *
 * **Styles are inlined by value, not by `styleId`.** An id is an index into one
 * `StyleRegistry`; it means nothing to a different workbook, so a snapshot
 * carrying ids would decode into whatever styles happened to occupy those slots.
 * `workbookFromSnapshot` re-interns each style, which restores the sharing on
 * the far side without the two registries ever having to agree on numbering.
 */

export interface CellSnapshot {
  row: number;
  col: number;
  value: CellValue;
  /** Present only for a formula cell; `value` is then its last computed result. */
  formula?: string;
  /** Absent when the cell uses the default style, which is the common case. */
  style?: CellStyle;
}

export interface SheetSnapshot {
  name: string;
  cells: CellSnapshot[];
  rows: Array<[number, RowProps]>;
  columns: Array<[number, ColumnProps]>;
  merges: RangeAddress[];
  frozen: FrozenPanes;
  view: SheetView;
  printArea: RangeAddress | null;
}

export interface WorkbookSnapshot {
  sheets: SheetSnapshot[];
}

/**
 * How many cells a snapshot may carry.
 *
 * A paper is fifteen questions in one request, each with its own workbook, and
 * the submit route caps the whole body at 2 MiB. An exam workbook is a table of
 * a few dozen cells; anything approaching this limit is a bug or an attempt to
 * make the server do unbounded work, and either way it must be refused here
 * rather than discovered by the JSON parser.
 */
export const MAX_SNAPSHOT_CELLS = 20_000;

export class SnapshotTooLargeError extends Error {
  constructor(cells: number) {
    super(`A workbook with ${cells} cells is too large to submit (limit ${MAX_SNAPSHOT_CELLS}).`);
    this.name = 'SnapshotTooLargeError';
  }
}

export function snapshotWorkbook(workbook: Workbook): WorkbookSnapshot {
  let total = 0;
  const sheets: SheetSnapshot[] = [];

  for (const sheet of workbook.allSheets()) {
    total += sheet.cellCount;
    if (total > MAX_SNAPSHOT_CELLS) throw new SnapshotTooLargeError(total);

    sheets.push(snapshotSheet(sheet, workbook));
  }

  return { sheets };
}

function snapshotSheet(sheet: Worksheet, workbook: Workbook): SheetSnapshot {
  const cells: CellSnapshot[] = [];

  for (const [address, cell] of sheet.entries()) {
    const style = workbook.styles.get(cell.styleId);

    cells.push({
      row: address.row,
      col: address.col,
      value: cell.value,
      ...(cell.formula === undefined ? {} : { formula: cell.formula }),
      // The default style is the one nearly every cell has; writing `{}` for
      // each of them would be the largest single contributor to the payload.
      ...(cell.styleId === DEFAULT_STYLE_ID ? {} : { style: { ...style } }),
    });
  }

  // Sorted so two workbooks holding the same cells produce byte-identical
  // snapshots. `Map` iteration follows insertion order, which is the order the
  // candidate happened to type in — not something a comparison should depend on.
  cells.sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));

  return {
    name: sheet.name,
    cells,
    rows: [...sheet.rows].map(([row, props]) => [row, { ...props }]),
    columns: [...sheet.columns].map(([col, props]) => [col, { ...props }]),
    merges: sheet.mergedRanges().map((merge) => ({ start: { ...merge.start }, end: { ...merge.end } })),
    frozen: { ...sheet.frozen },
    view: { ...sheet.view },
    printArea: sheet.printArea
      ? { start: { ...sheet.printArea.start }, end: { ...sheet.printArea.end } }
      : null,
  };
}

/**
 * Rebuilds a workbook from a snapshot.
 *
 * Used on the server to project a submitted answer, and on the client to load a
 * question's starting workbook. Both sides go through this same function, so a
 * snapshot that does not round-trip is a failure the tests can see rather than
 * a discrepancy between what was marked and what was shown.
 */
export function workbookFromSnapshot(snapshot: WorkbookSnapshot): Workbook {
  const workbook = new Workbook();

  snapshot.sheets.forEach((sheetSnapshot, index) => {
    const sheet = new Worksheet(`sheet${index + 1}`, sheetSnapshot.name);

    for (const cell of sheetSnapshot.cells) {
      const styleId = cell.style ? workbook.styles.intern(cell.style) : DEFAULT_STYLE_ID;
      const restored: Cell = {
        value: cell.value,
        ...(cell.formula === undefined ? {} : { formula: cell.formula }),
        styleId,
      };
      sheet.setCell(cell.row, cell.col, restored);
    }

    for (const [row, props] of sheetSnapshot.rows) sheet.setRowProps(row, { ...props });
    for (const [col, props] of sheetSnapshot.columns) sheet.setColumnProps(col, { ...props });
    for (const merge of sheetSnapshot.merges) sheet.mergeCells(merge);
    sheet.freeze(sheetSnapshot.frozen.rows, sheetSnapshot.frozen.columns);
    // Older snapshots predate these; the defaults are what they meant.
    sheet.view = { ...DEFAULT_SHEET_VIEW, ...sheetSnapshot.view };
    sheet.printArea = sheetSnapshot.printArea
      ? { start: { ...sheetSnapshot.printArea.start }, end: { ...sheetSnapshot.printArea.end } }
      : null;

    workbook.addSheet(sheet);
  });

  if (workbook.sheetCount === 0) workbook.addSheet(new Worksheet('sheet1', 'Sheet1'));

  return workbook;
}

/** A blank one-sheet snapshot, which is what a question with no data starts from. */
export function blankSnapshot(name = 'Sheet1'): WorkbookSnapshot {
  return {
    sheets: [
      {
        name,
        cells: [],
        rows: [],
        columns: [],
        merges: [],
        frozen: { rows: 0, columns: 0 },
        view: { ...DEFAULT_SHEET_VIEW },
        printArea: null,
      },
    ],
  };
}

/**
 * Whether two snapshots describe the same workbook.
 *
 * Both sides come out of `snapshotWorkbook`, which sorts its cells and drops
 * default styles, so they are already canonical and a string compare is enough.
 * This is what decides whether a question counts as attempted, so it runs when
 * the candidate moves between questions rather than on every keystroke.
 */
export function snapshotsEqual(a: WorkbookSnapshot, b: WorkbookSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
