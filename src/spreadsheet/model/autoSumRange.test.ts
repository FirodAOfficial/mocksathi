import { describe, expect, it } from 'vitest';
import { autoSumRange } from './autoSumRange';
import { Worksheet } from './Worksheet';

/**
 * AutoSum's whole value is that it guesses the range for you. A version that
 * inserts an empty `=SUM()` writes `#N/A` into the cell and is worse than no
 * button at all, so these pin the guess.
 */

function sheetWith(values: Array<[row: number, col: number, value: number | string]>): Worksheet {
  const sheet = new Worksheet('sheet1', 'Sheet1');
  for (const [row, col, value] of values) sheet.setCell(row, col, { value, styleId: 0 });
  return sheet;
}

/** Marks in B1:B5, with a text heading in B0 above them. */
const COLUMN = sheetWith([
  [0, 1, 'Marks'],
  [1, 1, 85],
  [2, 1, 92],
  [3, 1, 67],
  [4, 1, 78],
  [5, 1, 88],
]);

describe('autoSumRange', () => {
  it('takes the run of numbers above the cell', () => {
    expect(autoSumRange(COLUMN, { row: 6, col: 1 })).toEqual({
      start: { row: 1, col: 1 },
      end: { row: 5, col: 1 },
    });
  });

  it('stops at the heading rather than swallowing it', () => {
    // A text cell ends the run. Including it would make the total depend on a
    // word, which is the bug that makes AutoSum untrustworthy.
    expect(autoSumRange(COLUMN, { row: 6, col: 1 })?.start.row).toBe(1);
  });

  it('stops at a blank row', () => {
    const gapped = sheetWith([
      [1, 0, 10],
      [3, 0, 20],
      [4, 0, 30],
    ]);

    expect(autoSumRange(gapped, { row: 5, col: 0 })).toEqual({
      start: { row: 3, col: 0 },
      end: { row: 4, col: 0 },
    });
  });

  it('falls back to the run on the left when nothing is above', () => {
    const row = sheetWith([
      [2, 0, 'Total'],
      [2, 1, 5],
      [2, 2, 6],
      [2, 3, 7],
    ]);

    expect(autoSumRange(row, { row: 2, col: 4 })).toEqual({
      start: { row: 2, col: 1 },
      end: { row: 2, col: 3 },
    });
  });

  it('prefers above over left, as Excel does', () => {
    const both = sheetWith([
      [0, 1, 4],
      [1, 0, 9],
    ]);

    expect(autoSumRange(both, { row: 1, col: 1 })).toEqual({
      start: { row: 0, col: 1 },
      end: { row: 0, col: 1 },
    });
  });

  it('proposes nothing when there are no numbers to total', () => {
    // The caller says so instead of writing a formula that evaluates to #N/A.
    expect(autoSumRange(sheetWith([[0, 0, 'Name']]), { row: 5, col: 5 })).toBeNull();
    expect(autoSumRange(COLUMN, { row: 0, col: 0 })).toBeNull();
  });

  it('counts a formula’s numeric result as a number', () => {
    const computed = new Worksheet('sheet1', 'Sheet1');
    computed.setCell(0, 0, { value: 10, styleId: 0 });
    computed.setCell(1, 0, { value: 20, formula: '=A1*2', styleId: 0 });

    expect(autoSumRange(computed, { row: 2, col: 0 })).toEqual({
      start: { row: 0, col: 0 },
      end: { row: 1, col: 0 },
    });
  });
});
