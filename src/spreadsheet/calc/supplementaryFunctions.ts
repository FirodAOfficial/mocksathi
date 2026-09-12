import type { FormulaValue } from 'fast-formula-parser';

/**
 * Functions `fast-formula-parser` does not implement.
 *
 * The library covers most of Excel's library but not all of it, and the gaps
 * are not obscure: `MIN`, `MAX`, `COUNTA`, `UPPER` and `MEDIAN` are all things a
 * practical paper asks for directly. Without these, `=MIN(B2:B6)` returns
 * `#NAME?` — indistinguishable, to a candidate, from having typed it wrong.
 *
 * Registered through the parser's own `functions` hook rather than patched into
 * the library, so replacing the engine later means re-registering these against
 * the new one, not unpicking a fork.
 *
 * How arguments arrive: each is `{ value, isRangeRef, isCellRef, isArray }`,
 * where a range's `value` is rows of cells. `flat` below is what turns that
 * back into the list of numbers Excel's aggregate functions operate on.
 */

/** One argument as the parser hands it over. */
interface Argument {
  value: unknown;
  isArray?: boolean;
  isRangeRef?: boolean;
  isCellRef?: boolean;
}

/** Every scalar an argument contains, ranges flattened, blanks dropped. */
function flat(args: Argument[]): unknown[] {
  const out: unknown[] = [];

  const push = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) push(item);
      return;
    }
    if (value === null || value === undefined || value === '') return;
    out.push(value);
  };

  for (const argument of args) push(argument?.value);
  return out;
}

/**
 * The numbers among the arguments.
 *
 * Excel's aggregates ignore text and booleans inside a range — `MIN` over a
 * column with a header does not fail, it skips the header — so this filters
 * rather than coercing.
 */
function numbers(args: Argument[]): number[] {
  return flat(args).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

export const SUPPLEMENTARY_FUNCTIONS: Record<string, (...args: never[]) => FormulaValue> = {
  MIN: (...args: never[]): FormulaValue => {
    const values = numbers(args as unknown as Argument[]);
    // Excel returns 0, not an error, when a range holds no numbers.
    return values.length === 0 ? 0 : Math.min(...values);
  },

  MAX: (...args: never[]): FormulaValue => {
    const values = numbers(args as unknown as Argument[]);
    return values.length === 0 ? 0 : Math.max(...values);
  },

  /** Counts everything that is not blank, unlike COUNT which counts numbers. */
  COUNTA: (...args: never[]): FormulaValue => flat(args as unknown as Argument[]).length,

  UPPER: (...args: never[]): FormulaValue => {
    const [first] = flat(args as unknown as Argument[]);
    return first === undefined ? '' : String(first).toUpperCase();
  },

  MEDIAN: (...args: never[]): FormulaValue => {
    const values = numbers(args as unknown as Argument[]).sort((a, b) => a - b);
    if (values.length === 0) return '#NUM!';

    const middle = Math.floor(values.length / 2);
    return values.length % 2 === 0 ? (values[middle - 1]! + values[middle]!) / 2 : values[middle]!;
  },
};
