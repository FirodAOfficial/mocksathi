import type { StyleId } from './styles';

/**
 * What lives in a cell.
 *
 * Dates are deliberately absent from the value union: Excel stores a date as a
 * number and decides it is a date through its number format, and a workbook
 * round-trips correctly only if we do the same. A cell showing `01/03/2024` is
 * `{ value: 45352, styleId: <one whose numberFormat is a date code> }`.
 */

/** Excel's seven error values. They are values, not exceptions. */
export type ErrorValue =
  | '#DIV/0!'
  | '#N/A'
  | '#NAME?'
  | '#NULL!'
  | '#NUM!'
  | '#REF!'
  | '#VALUE!';

export const ERROR_VALUES: readonly ErrorValue[] = [
  '#DIV/0!',
  '#N/A',
  '#NAME?',
  '#NULL!',
  '#NUM!',
  '#REF!',
  '#VALUE!',
];

export function isErrorValue(value: unknown): value is ErrorValue {
  return typeof value === 'string' && (ERROR_VALUES as readonly string[]).includes(value);
}

export type CellValue = string | number | boolean | ErrorValue | null;

export interface Cell {
  /**
   * The cell's value — for a formula cell, the last computed result.
   *
   * Caching it here is what lets the grid render without touching the
   * calculation engine: scrolling must never trigger evaluation.
   */
  value: CellValue;
  /**
   * The formula text including its leading `=`, when the cell holds one.
   *
   * Kept as source rather than as a parsed tree: the formula bar shows exactly
   * what was typed, and a formula the engine cannot parse still round-trips
   * instead of being silently dropped.
   */
  formula?: string;
  styleId: StyleId;
}

/**
 * How a cell's raw text was interpreted.
 *
 * Excel decides this at entry time — typing `TRUE` gives a boolean, `00123`
 * stays text, `=1+1` is a formula — and the decision changes alignment as well
 * as arithmetic, so it belongs with the value rather than at render time.
 */
export type CellType = 'blank' | 'number' | 'text' | 'boolean' | 'error' | 'formula';

export function cellType(cell: Cell | undefined): CellType {
  if (!cell) return 'blank';
  if (cell.formula !== undefined) return 'formula';
  if (cell.value === null) return 'blank';
  if (isErrorValue(cell.value)) return 'error';
  if (typeof cell.value === 'number') return 'number';
  if (typeof cell.value === 'boolean') return 'boolean';
  return 'text';
}

export function isBlank(cell: Cell | undefined): boolean {
  return !cell || (cell.value === null && cell.formula === undefined);
}

/*
 * Reading a typed entry lives in `parseInput.ts`, not here: what the user typed
 * decides the cell's number format as well as its value — `23/09/2026` is a
 * number wearing a date format — and that needs the format vocabulary, which
 * this module deliberately does not depend on.
 */
