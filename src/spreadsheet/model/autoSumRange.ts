import { MAX_COLUMNS, MAX_ROWS, type CellAddress, type RangeAddress } from './address';
import type { Worksheet } from './Worksheet';

/**
 * The range AutoSum proposes for a cell.
 *
 * Excel does not insert an empty `=SUM()`; it looks for the numbers you almost
 * certainly meant. The rule it uses, and the one implemented here:
 *
 * 1. If the cell directly above holds a number, take the unbroken run of
 *    numbers going up.
 * 2. Otherwise, if the cell directly to the left holds a number, take the
 *    unbroken run going left.
 * 3. Otherwise there is nothing to total.
 *
 * A blank or a text cell ends the run, which is what stops a column total from
 * swallowing its own heading.
 *
 * Returns `null` when there is nothing to propose, so the caller can say so
 * rather than writing a formula that evaluates to `#N/A`.
 */
export function autoSumRange(sheet: Worksheet, active: CellAddress): RangeAddress | null {
  const isNumber = (row: number, col: number): boolean =>
    typeof sheet.getValue(row, col) === 'number';

  if (active.row > 0 && isNumber(active.row - 1, active.col)) {
    let top = active.row - 1;
    while (top > 0 && isNumber(top - 1, active.col)) top -= 1;

    return { start: { row: top, col: active.col }, end: { row: active.row - 1, col: active.col } };
  }

  if (active.col > 0 && isNumber(active.row, active.col - 1)) {
    let left = active.col - 1;
    while (left > 0 && isNumber(active.row, left - 1)) left -= 1;

    return { start: { row: active.row, col: left }, end: { row: active.row, col: active.col - 1 } };
  }

  return null;
}

/** One total AutoSum writes: the cell it goes in, and the range it adds up. */
export interface AutoSumWrite {
  cell: CellAddress;
  range: RangeAddress;
}

/**
 * Where AutoSum writes its totals, given the selection.
 *
 * - **One cell** (or one merged block): the total goes in that cell, over the
 *   range `autoSumRange` proposes.
 * - **A range whose last row is empty**: column totals in that row.
 * - **A range whose last column is empty**: row totals in that column.
 * - **A range full of numbers**: column totals in the row below it — or, for a
 *   single row, a total in the cell to its right. Never inside the selection:
 *   writing into it is how a drag over A1:A3 used to replace the 3 in A3 with
 *   `=SUM(A1:A2)`.
 *
 * Only columns (or rows) holding numbers get a total, and a target that is
 * not empty is left alone rather than overwritten. Empty when there is nothing
 * to total, so the caller can say so.
 */
export function autoSumTargets(
  sheet: Worksheet,
  selection: RangeAddress,
  active: CellAddress,
): AutoSumWrite[] {
  const merge = sheet.mergeCovering(active.row, active.col);
  const oneBlock =
    (selection.start.row === selection.end.row && selection.start.col === selection.end.col) ||
    (merge !== undefined &&
      merge.start.row === selection.start.row &&
      merge.start.col === selection.start.col &&
      merge.end.row === selection.end.row &&
      merge.end.col === selection.end.col);

  if (oneBlock) {
    const range = autoSumRange(sheet, active);
    return range ? [{ cell: active, range }] : [];
  }

  const { start, end } = selection;
  const isBlank = (row: number, col: number): boolean => {
    const cell = sheet.getCell(row, col);
    return !cell || (cell.value === null && !cell.formula);
  };
  const isNumber = (row: number, col: number): boolean =>
    typeof sheet.getValue(row, col) === 'number';

  const columnTotals = (totalRow: number, lastRow: number): AutoSumWrite[] => {
    const writes: AutoSumWrite[] = [];
    for (let col = start.col; col <= end.col; col += 1) {
      if (!isBlank(totalRow, col)) continue;
      let hasNumber = false;
      for (let row = start.row; row <= lastRow && !hasNumber; row += 1) hasNumber = isNumber(row, col);
      if (!hasNumber) continue;
      writes.push({
        cell: { row: totalRow, col },
        range: { start: { row: start.row, col }, end: { row: lastRow, col } },
      });
    }
    return writes;
  };

  const rowTotals = (totalCol: number, lastCol: number): AutoSumWrite[] => {
    const writes: AutoSumWrite[] = [];
    for (let row = start.row; row <= end.row; row += 1) {
      if (!isBlank(row, totalCol)) continue;
      let hasNumber = false;
      for (let col = start.col; col <= lastCol && !hasNumber; col += 1) hasNumber = isNumber(row, col);
      if (!hasNumber) continue;
      writes.push({
        cell: { row, col: totalCol },
        range: { start: { row, col: start.col }, end: { row, col: lastCol } },
      });
    }
    return writes;
  };

  const rowEmpty = (row: number): boolean => {
    for (let col = start.col; col <= end.col; col += 1) if (!isBlank(row, col)) return false;
    return true;
  };
  const columnEmpty = (col: number): boolean => {
    for (let row = start.row; row <= end.row; row += 1) if (!isBlank(row, col)) return false;
    return true;
  };

  if (end.row > start.row && rowEmpty(end.row)) return columnTotals(end.row, end.row - 1);
  if (end.col > start.col && columnEmpty(end.col)) return rowTotals(end.col, end.col - 1);
  if (end.row > start.row) return end.row + 1 < MAX_ROWS ? columnTotals(end.row + 1, end.row) : [];
  return end.col + 1 < MAX_COLUMNS ? rowTotals(end.col + 1, end.col) : [];
}
