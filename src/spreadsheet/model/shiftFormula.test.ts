import { describe, expect, it } from 'vitest';
import { shiftFormula, type SheetEdit } from './shiftFormula';

/**
 * The rule these protect: a formula must never quietly point somewhere else.
 *
 * Inserting a row above a total and leaving `=SUM(B2:B6)` untouched produces a
 * number that is plausible and wrong, which is the worst failure this editor
 * has — a candidate cannot see it, and neither can the marker.
 */

const insertRow3: SheetEdit = { axis: 'row', at: 2, delta: 1 };
const deleteRow3: SheetEdit = { axis: 'row', at: 2, delta: -1 };
const insertColB: SheetEdit = { axis: 'column', at: 1, delta: 1 };

describe('shiftFormula — inserting', () => {
  it('moves a reference at or after the insertion', () => {
    expect(shiftFormula('=B7', insertRow3)).toBe('=B8');
    expect(shiftFormula('=B3', insertRow3)).toBe('=B4');
  });

  it('leaves a reference above the insertion alone', () => {
    expect(shiftFormula('=B2', insertRow3)).toBe('=B2');
  });

  it('grows a range the insertion falls inside', () => {
    // =SUM(B2:B6) with a row inserted at 3 must cover the new row: B2:B7.
    expect(shiftFormula('=SUM(B2:B6)', insertRow3)).toBe('=SUM(B2:B7)');
  });

  it('moves absolute references too', () => {
    // $B$7 means "row 7 wherever I copy this", not "row 7 whatever happens to
    // the sheet". Excel moves it, and every anchored total depends on that.
    expect(shiftFormula('=$B$7', insertRow3)).toBe('=$B$8');
  });

  it('shifts columns on a column edit and leaves rows alone', () => {
    expect(shiftFormula('=C5', insertColB)).toBe('=D5');
    expect(shiftFormula('=A5', insertColB)).toBe('=A5');
  });
});

describe('shiftFormula — deleting', () => {
  it('moves a reference after the deletion back', () => {
    expect(shiftFormula('=B7', deleteRow3)).toBe('=B6');
  });

  it('turns a reference to the deleted cell into #REF!', () => {
    // Repointing it at whatever moved up would be plausible and wrong.
    expect(shiftFormula('=B3', deleteRow3)).toBe('=#REF!');
  });

  it('shrinks a range that loses a row from its middle', () => {
    expect(shiftFormula('=SUM(B2:B6)', deleteRow3)).toBe('=SUM(B2:B5)');
  });

  it('handles a multi-row deletion', () => {
    const deleteRows3to5: SheetEdit = { axis: 'row', at: 2, delta: -3 };

    expect(shiftFormula('=B8', deleteRows3to5)).toBe('=B5');
    expect(shiftFormula('=B4', deleteRows3to5)).toBe('=#REF!');
    expect(shiftFormula('=B2', deleteRows3to5)).toBe('=B2');
  });
});

describe('shiftFormula — what it must not touch', () => {
  it('leaves references inside string literals alone', () => {
    expect(shiftFormula('="B7 is "&B7', insertRow3)).toBe('="B7 is "&B8');
  });

  it('does not rename a function that looks like a reference', () => {
    // LOG10( must not become LOG11(.
    expect(shiftFormula('=LOG10(B7)', insertRow3)).toBe('=LOG10(B8)');
  });

  it('returns the formula unchanged when nothing moved', () => {
    expect(shiftFormula('=SUM(B2:B6)', { axis: 'row', at: 9, delta: 1 })).toBe('=SUM(B2:B6)');
  });

  it('keeps a sheet-qualified reference qualified', () => {
    expect(shiftFormula('=Sheet2!B7', insertRow3)).toBe('=Sheet2!B8');
  });
});
