import { describe, expect, it } from 'vitest';
import { applySheetEdit, sortBlocker, sortSheetRange } from './structuralEdit';
import { blankSnapshot, type SheetSnapshot } from './snapshot';
import type { RangeAddress } from './address';

/**
 * Structural edits move cells *and* the formulas that point at them. A row
 * inserted above a total that leaves `=SUM(B2:B6)` untouched gives a number
 * that is plausible and wrong — invisible to the candidate and to the marker.
 */

function sheet(cells: Array<[row: number, col: number, value: string | number, formula?: string]>): SheetSnapshot {
  const snapshot = blankSnapshot().sheets[0]!;
  snapshot.cells = cells.map(([row, col, value, formula]) => ({
    row,
    col,
    value,
    ...(formula === undefined ? {} : { formula }),
  }));
  return snapshot;
}

/** Marks in B2:B6 with a SUM in B8, the shape most questions use. */
const TABLE = sheet([
  [0, 1, 'Marks'],
  [1, 1, 85],
  [2, 1, 92],
  [3, 1, 67],
  [4, 1, 78],
  [5, 1, 88],
  [7, 1, 410, '=SUM(B2:B6)'],
]);

const at = (snapshot: SheetSnapshot, row: number, col: number) =>
  snapshot.cells.find((cell) => cell.row === row && cell.col === col);

describe('inserting a row', () => {
  const after = applySheetEdit(TABLE, { axis: 'row', at: 2, delta: 1 });

  it('moves the cells below it down', () => {
    expect(at(after, 1, 1)?.value).toBe(85);
    expect(at(after, 2, 1)).toBeUndefined();
    expect(at(after, 3, 1)?.value).toBe(92);
  });

  it('moves the formula and grows the range it covers', () => {
    expect(at(after, 8, 1)?.formula).toBe('=SUM(B2:B7)');
  });

  it('moves a column width with its column', () => {
    const widened: SheetSnapshot = { ...TABLE, columns: [[1, { width: 140 }]] };
    const shifted = applySheetEdit(widened, { axis: 'column', at: 0, delta: 1 });

    expect(shifted.columns).toEqual([[2, { width: 140 }]]);
  });

  it('grows the frozen rows when the insertion is inside them', () => {
    const frozen: SheetSnapshot = { ...TABLE, frozen: { rows: 2, columns: 0 } };

    expect(applySheetEdit(frozen, { axis: 'row', at: 1, delta: 1 }).frozen.rows).toBe(3);
    // Below the frozen band, the count is unchanged.
    expect(applySheetEdit(frozen, { axis: 'row', at: 5, delta: 1 }).frozen.rows).toBe(2);
  });
});

describe('deleting a row', () => {
  const after = applySheetEdit(TABLE, { axis: 'row', at: 2, delta: -1 });

  it('removes the row and pulls the rest up', () => {
    expect(at(after, 2, 1)?.value).toBe(67);
    expect(after.cells.some((cell) => cell.value === 92)).toBe(false);
  });

  it('shrinks a range that lost a row from its middle', () => {
    expect(at(after, 6, 1)?.formula).toBe('=SUM(B2:B5)');
  });

  it('turns a formula pointing at the deleted row into #REF!', () => {
    const pointed = sheet([
      [2, 1, 92],
      [5, 0, 92, '=B3'],
    ]);
    const gone = applySheetEdit(pointed, { axis: 'row', at: 2, delta: -1 });

    expect(at(gone, 4, 0)?.formula).toBe('=#REF!');
  });

  it('drops a merge whose whole span was deleted', () => {
    const merged: SheetSnapshot = {
      ...TABLE,
      merges: [{ start: { row: 2, col: 0 }, end: { row: 2, col: 3 } }],
    };

    expect(applySheetEdit(merged, { axis: 'row', at: 2, delta: -1 }).merges).toEqual([]);
  });

  it('clears a print area that was wholly deleted', () => {
    const printed: SheetSnapshot = {
      ...TABLE,
      printArea: { start: { row: 2, col: 0 }, end: { row: 2, col: 3 } },
    };

    expect(applySheetEdit(printed, { axis: 'row', at: 2, delta: -1 }).printArea).toBeNull();
  });
});

describe('sorting', () => {
  const NAMES = sheet([
    [0, 0, 'Rahul'],
    [0, 1, 85],
    [1, 0, 'Amit'],
    [1, 1, 67],
    [2, 0, 'Priya'],
    [2, 1, 92],
  ]);
  const range: RangeAddress = { start: { row: 0, col: 0 }, end: { row: 2, col: 1 } };

  it('moves whole rows, keeping each record together', () => {
    const sorted = sortSheetRange(NAMES, range, 0, 'asc');

    expect(at(sorted, 0, 0)?.value).toBe('Amit');
    expect(at(sorted, 0, 1)?.value).toBe(67);
    expect(at(sorted, 2, 0)?.value).toBe('Rahul');
  });

  it('sorts descending', () => {
    const sorted = sortSheetRange(NAMES, range, 1, 'desc');

    expect(at(sorted, 0, 1)?.value).toBe(92);
    expect(at(sorted, 2, 1)?.value).toBe(67);
  });

  it('leaves cells outside the range alone', () => {
    const withNote = { ...NAMES, cells: [...NAMES.cells, { row: 0, col: 5, value: 'note' }] };
    const sorted = sortSheetRange(withNote, range, 0, 'asc');

    expect(at(sorted, 0, 5)?.value).toBe('note');
  });

  it('puts blanks last whichever way the sort runs', () => {
    // A blank is an absent value, not the smallest one.
    const gapped = sheet([
      [0, 0, 'b'],
      [2, 0, 'a'],
    ]);
    const asc = sortSheetRange(gapped, { start: { row: 0, col: 0 }, end: { row: 2, col: 0 } }, 0, 'asc');

    expect(at(asc, 0, 0)?.value).toBe('a');
    expect(at(asc, 2, 0)).toBeUndefined();
  });
});

describe('sortBlocker', () => {
  const range: RangeAddress = { start: { row: 0, col: 0 }, end: { row: 2, col: 1 } };

  it('allows a plain range of values', () => {
    expect(sortBlocker(sheet([[0, 0, 'a']]), range)).toBeNull();
  });

  it('refuses a range holding a formula, and says why', () => {
    // Moving it would have to move its references too; being subtly wrong here
    // is worse than refusing.
    const withFormula = sheet([[1, 1, 5, '=A1']]);

    expect(sortBlocker(withFormula, range)).toContain('formula');
  });

  it('refuses a range holding merged cells', () => {
    const merged: SheetSnapshot = {
      ...sheet([[0, 0, 'a']]),
      merges: [{ start: { row: 0, col: 0 }, end: { row: 0, col: 1 } }],
    };

    expect(sortBlocker(merged, range)).toContain('merged');
  });
});
