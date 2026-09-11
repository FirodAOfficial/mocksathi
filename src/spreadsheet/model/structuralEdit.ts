import type { CellValue } from './Cell';
import { shiftFormula, type SheetEdit } from './shiftFormula';
import type { CellSnapshot, SheetSnapshot } from './snapshot';
import type { RangeAddress } from './address';

/**
 * Inserting and deleting rows and columns, and sorting a range.
 *
 * Written as pure transforms over a sheet snapshot, then rebuilt with
 * `sheetFromSnapshot`. Editing `Worksheet` in place would mean rewriting its
 * row index, merge table and bounds cache by hand — four places to get wrong,
 * none of them the interesting part.
 *
 * The interesting part is that **every formula on the sheet has to follow**.
 * A row inserted above a total that leaves `=SUM(B2:B6)` untouched gives a
 * number that is plausible and wrong, and neither the candidate nor the marker
 * can see it. `shiftFormula` does that work; this decides what moves.
 */

export type { SheetEdit };

/** Which axis a position lives on, for the shared shifting below. */
function positionOf(cell: { row: number; col: number }, axis: SheetEdit['axis']): number {
  return axis === 'row' ? cell.row : cell.col;
}

function withPosition<T extends { row: number; col: number }>(
  cell: T,
  axis: SheetEdit['axis'],
  position: number,
): T {
  return axis === 'row' ? { ...cell, row: position } : { ...cell, col: position };
}

/**
 * Where a position lands after the edit, or `null` if it was deleted.
 *
 * The same rule `shiftFormula` applies to references, applied here to the cells
 * themselves — so the two cannot disagree about what moved.
 */
function movePosition(position: number, edit: SheetEdit): number | null {
  if (position < edit.at) return position;

  if (edit.delta < 0 && position <= edit.at - edit.delta - 1) return null;

  const moved = position + edit.delta;
  return moved < 0 ? null : moved;
}

export function applySheetEdit(snapshot: SheetSnapshot, edit: SheetEdit): SheetSnapshot {
  const cells: CellSnapshot[] = [];

  for (const cell of snapshot.cells) {
    const moved = movePosition(positionOf(cell, edit.axis), edit);
    if (moved === null) continue;

    const shifted = withPosition(cell, edit.axis, moved);
    cells.push(
      shifted.formula === undefined
        ? shifted
        : { ...shifted, formula: shiftFormula(shifted.formula, edit) },
    );
  }

  cells.sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));

  /** Row heights and column widths travel with their row or column. */
  const moveProps = <T>(entries: Array<[number, T]>, axis: SheetEdit['axis']): Array<[number, T]> => {
    if (axis !== edit.axis) return entries.map((entry) => [entry[0], entry[1]]);

    const out: Array<[number, T]> = [];
    for (const [index, props] of entries) {
      const moved = movePosition(index, edit);
      if (moved !== null) out.push([moved, props]);
    }
    return out;
  };

  return {
    ...snapshot,
    cells,
    rows: moveProps(snapshot.rows, 'row'),
    columns: moveProps(snapshot.columns, 'column'),
    // A merge whose span is wholly deleted goes with it; one that straddles the
    // edit grows or shrinks, which is what moving its two corners produces.
    merges: snapshot.merges.flatMap((merge) => {
      const start = movePosition(positionOf(merge.start, edit.axis), edit);
      const end = movePosition(positionOf(merge.end, edit.axis), edit);
      if (start === null && end === null) return [];

      const from = start ?? edit.at;
      const to = end ?? edit.at - 1;
      if (to < from) return [];

      return [
        {
          start: withPosition(merge.start, edit.axis, from),
          end: withPosition(merge.end, edit.axis, to),
        },
      ];
    }),
    // Frozen panes are a count of rows or columns held at the top or left, so
    // an edit inside them changes the count.
    frozen:
      edit.axis === 'row'
        ? { ...snapshot.frozen, rows: adjustCount(snapshot.frozen.rows, edit) }
        : { ...snapshot.frozen, columns: adjustCount(snapshot.frozen.columns, edit) },
    printArea: snapshot.printArea ? movedRange(snapshot.printArea, edit) : null,
  };
}

function adjustCount(count: number, edit: SheetEdit): number {
  if (count === 0 || edit.at >= count) return count;
  return Math.max(0, count + edit.delta);
}

function movedRange(range: RangeAddress, edit: SheetEdit): RangeAddress | null {
  const start = movePosition(positionOf(range.start, edit.axis), edit);
  const end = movePosition(positionOf(range.end, edit.axis), edit);
  if (start === null && end === null) return null;

  const from = start ?? edit.at;
  const to = end ?? edit.at - 1;
  if (to < from) return null;

  return {
    start: withPosition(range.start, edit.axis, from),
    end: withPosition(range.end, edit.axis, to),
  };
}

/* -- Sorting --------------------------------------------------------------- */

export type SortDirection = 'asc' | 'desc';

/**
 * Why a range cannot be sorted, or `null` when it can.
 *
 * Sorting moves rows; a formula in or pointing at those rows would have to move
 * with them, and getting that wrong produces a plausible wrong number. Rather
 * than attempt it and be subtly wrong, this refuses and says which cell is the
 * problem — which is the difference between a limitation and a bug.
 */
export function sortBlocker(snapshot: SheetSnapshot, range: RangeAddress): string | null {
  const inside = (cell: { row: number; col: number }): boolean =>
    cell.row >= range.start.row &&
    cell.row <= range.end.row &&
    cell.col >= range.start.col &&
    cell.col <= range.end.col;

  for (const cell of snapshot.cells) {
    if (cell.formula === undefined) continue;
    if (inside(cell)) return 'the range contains a formula, which sorting would move';
  }

  for (const merge of snapshot.merges) {
    if (inside(merge.start) || inside(merge.end)) return 'the range contains merged cells';
  }

  return null;
}

/**
 * The range sorted by one of its columns.
 *
 * Rows move whole, carrying their formatting, so sorting a table by one column
 * keeps each record together — which is the only sort anyone means. Cells
 * outside the range are untouched.
 */
export function sortSheetRange(
  snapshot: SheetSnapshot,
  range: RangeAddress,
  byColumn: number,
  direction: SortDirection,
): SheetSnapshot {
  const inside = (cell: CellSnapshot): boolean =>
    cell.row >= range.start.row &&
    cell.row <= range.end.row &&
    cell.col >= range.start.col &&
    cell.col <= range.end.col;

  const outside = snapshot.cells.filter((cell) => !inside(cell));

  const rows: Array<{ key: CellValue; cells: CellSnapshot[] }> = [];
  for (let row = range.start.row; row <= range.end.row; row += 1) {
    const cells = snapshot.cells.filter((cell) => inside(cell) && cell.row === row);
    rows.push({ key: cells.find((cell) => cell.col === byColumn)?.value ?? null, cells });
  }

  rows.sort((a, b) => compare(a.key, b.key) * (direction === 'asc' ? 1 : -1));

  const sorted = rows.flatMap((entry, index) =>
    entry.cells.map((cell) => ({ ...cell, row: range.start.row + index })),
  );

  const cells = [...outside, ...sorted];
  cells.sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));

  return { ...snapshot, cells };
}

/**
 * Excel's sort order: numbers before text, and blanks last whichever way the
 * sort runs — a blank is an absent value, not the smallest one.
 */
function compare(a: CellValue, b: CellValue): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'number') return -1;
  if (typeof b === 'number') return 1;

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}
