import type { CellAddress, RangeAddress } from './address';
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
