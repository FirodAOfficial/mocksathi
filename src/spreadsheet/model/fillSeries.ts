import type { CellValue } from './Cell';

/**
 * What Auto Fill produces when a selection is dragged by its handle.
 *
 * Excel's rules, in the order it applies them:
 *
 * 1. A recognised list — month names, weekday names — continues and wraps.
 * 2. Two or more numbers continue their arithmetic step.
 * 3. One number is copied. (Excel needs Ctrl to step a single number; a paper
 *    that asks for 1, 2, 3 gives the candidate the first two.)
 * 4. Text ending in digits increments those digits: `STU1101` → `STU1102`.
 * 5. Anything else repeats.
 *
 * Kept as a pure function over values so the behaviour can be pinned without a
 * grid, a pointer or a workbook.
 */

/** The lists Excel fills from, in both the short and the long form. */
const SERIES_LISTS: string[][] = [
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
];

interface ListMatch {
  list: string[];
  index: number;
}

function findInLists(value: CellValue): ListMatch | null {
  if (typeof value !== 'string') return null;

  const wanted = value.trim().toLowerCase();
  for (const list of SERIES_LISTS) {
    const index = list.findIndex((entry) => entry.toLowerCase() === wanted);
    if (index !== -1) return { list, index };
  }
  return null;
}

/** Text with a trailing run of digits, e.g. `STU1101`. */
const TRAILING_NUMBER = /^(.*?)(\d+)$/;

/**
 * `count` values continuing from `source`.
 *
 * `source` is what the candidate selected before dragging; the result is what
 * fills the cells they dragged over — the source itself is not repeated.
 */
export function fillSeries(source: readonly CellValue[], count: number): CellValue[] {
  if (count <= 0) return [];

  const seed = source.filter((value) => value !== null);
  if (seed.length === 0) return Array.from({ length: count }, () => null);

  const listed = findInLists(seed[seed.length - 1]!);
  if (listed) {
    // Wraps, as Excel does: December is followed by January.
    return Array.from({ length: count }, (_, offset) => {
      const entry = listed.list[(listed.index + offset + 1) % listed.list.length]!;
      return matchCase(entry, seed[seed.length - 1] as string);
    });
  }

  const numbers = seed.filter((value): value is number => typeof value === 'number');
  if (numbers.length === seed.length && numbers.length >= 2) {
    const step = numbers[numbers.length - 1]! - numbers[numbers.length - 2]!;
    const last = numbers[numbers.length - 1]!;
    return Array.from({ length: count }, (_, offset) => last + step * (offset + 1));
  }

  const lastValue = seed[seed.length - 1]!;
  if (typeof lastValue === 'string' && seed.length === 1) {
    const match = TRAILING_NUMBER.exec(lastValue);
    if (match) {
      const [, prefix = '', digits = '0'] = match;
      const start = Number(digits);
      // Padding is kept: `STU007` continues `STU008`, not `STU8`.
      return Array.from({ length: count }, (_, offset) =>
        `${prefix}${String(start + offset + 1).padStart(digits.length, '0')}`,
      );
    }
  }

  // Everything else repeats the source, cycling if it held more than one value.
  return Array.from({ length: count }, (_, offset) => seed[offset % seed.length]!);
}

/**
 * The continued entry, cased like the value it continues.
 *
 * A candidate who typed `jan` gets `feb`, not `Feb` — Excel follows the case
 * of what is already there rather than imposing the list's.
 */
function matchCase(entry: string, seed: string): string {
  const trimmed = seed.trim();
  if (trimmed === trimmed.toUpperCase() && trimmed !== trimmed.toLowerCase()) return entry.toUpperCase();
  if (trimmed === trimmed.toLowerCase()) return entry.toLowerCase();
  return entry;
}
