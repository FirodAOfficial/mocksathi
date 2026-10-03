import FormulaParser from 'fast-formula-parser';
import { describe, expect, it } from 'vitest';
import { FUNCTION_CATALOG, completionSlot, functionsStartingWith } from './functionCatalog';
import { SUPPLEMENTARY_FUNCTIONS } from './supplementaryFunctions';

/** Fetches from the network; not something a sitting should offer. */
const WITHHELD = new Set(['WEBSERVICE']);

describe('FUNCTION_CATALOG', () => {
  const parser = new FormulaParser({
    onCell: () => 1,
    onRange: () => [[1]],
    functions: SUPPLEMENTARY_FUNCTIONS,
  });
  const offered = FUNCTION_CATALOG.map((entry) => entry.name);

  it('offers nothing the engine would answer with #NAME?', () => {
    const missing = offered.filter((name) => {
      try {
        parser.parse(`${name}(1)`, { row: 5, col: 5, sheet: 'Sheet1' });
      } catch (error) {
        // Wrong-argument errors are fine; only a missing function is not.
        return error instanceof Error && error.message.includes('not implemented');
      }
      return false;
    });

    expect(missing).toEqual([]);
  });

  it('offers everything the engine reports it can evaluate', () => {
    // `supportedFunctions()` is a heuristic that misses a few (LEN among them),
    // which the test above covers from the other side.
    const engine = [...parser.supportedFunctions(), ...Object.keys(SUPPLEMENTARY_FUNCTIONS)];
    expect(engine.filter((name) => !WITHHELD.has(name) && !offered.includes(name))).toEqual([]);
  });

  it('is alphabetical, as Excel lists it', () => {
    const names = FUNCTION_CATALOG.map((entry) => entry.name);
    expect(names).toEqual([...names].sort());
  });

  it('filters by prefix, ignoring case', () => {
    expect(functionsStartingWith('vlo').map((entry) => entry.name)).toEqual(['VLOOKUP']);
    expect(functionsStartingWith('')).toBe(FUNCTION_CATALOG);
  });
});

describe('completionSlot', () => {
  it('offers everything right after the leading =', () => {
    expect(completionSlot('=', 1)).toEqual({ start: 1, end: 1, prefix: '' });
  });

  it('offers names being typed where an operand belongs', () => {
    expect(completionSlot('=su', 3)).toEqual({ start: 1, end: 3, prefix: 'su' });
    expect(completionSlot('=A1+RO', 6)).toEqual({ start: 4, end: 6, prefix: 'RO' });
    expect(completionSlot('=IF(LE', 6)).toEqual({ start: 4, end: 6, prefix: 'LE' });
  });

  it('replaces the whole word under the caret', () => {
    expect(completionSlot('=SUMX(A1)', 3)).toEqual({ start: 1, end: 5, prefix: 'SU' });
  });

  it('stays out of plain entries, strings and finished operands', () => {
    expect(completionSlot('su', 2)).toBeNull();
    expect(completionSlot('=IF(A1="ab', 10)).toBeNull();
    expect(completionSlot('=SUM(A1)', 8)).toBeNull();
    expect(completionSlot('=5', 2)).toBeNull();
  });
});
