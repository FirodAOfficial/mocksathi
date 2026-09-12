import { describe, expect, it } from 'vitest';
import { translateFormula } from './translateFormula';

/**
 * Copy/paste and the fill handle both rest on this. A mistake here produces
 * numbers that look right and are not, which is worse than a visible failure.
 */

describe('translateFormula', () => {
  it('moves a relative reference by the distance copied', () => {
    expect(translateFormula('=B1+1', 1, 0)).toBe('=B2+1');
    expect(translateFormula('=B1', 0, 2)).toBe('=D1');
  });

  it('leaves an anchored reference where it is', () => {
    expect(translateFormula('=B1+$C$1', 1, 0)).toBe('=B2+$C$1');
    expect(translateFormula('=$B1', 2, 3)).toBe('=$B3');
    expect(translateFormula('=B$1', 2, 3)).toBe('=E$1');
  });

  it('translates every reference in a range', () => {
    expect(translateFormula('=SUM(A1:A10)', 1, 0)).toBe('=SUM(A2:A11)');
  });

  it('does not touch a function name that looks like a reference', () => {
    expect(translateFormula('=LOG10(A1)', 1, 0)).toBe('=LOG10(A2)');
  });

  it('leaves references inside a string literal alone', () => {
    expect(translateFormula('="A1 is "&A1', 1, 0)).toBe('="A1 is "&A2');
  });

  it('keeps a sheet qualifier', () => {
    expect(translateFormula('=Sheet2!B1', 1, 0)).toBe('=Sheet2!B2');
  });

  it('produces #REF! rather than clamping off the grid', () => {
    expect(translateFormula('=A1', -1, 0)).toBe('=#REF!');
  });

  it('is a no-op when nothing moved', () => {
    expect(translateFormula('=SUM(A1:B2)', 0, 0)).toBe('=SUM(A1:B2)');
  });
});
