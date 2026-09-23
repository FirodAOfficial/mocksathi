import { isErrorValue, type CellValue } from './Cell';
import { NUMBER_FORMATS, dateToSerial } from './format';

/**
 * What typing into a cell means.
 *
 * Excel decides a cell's *type and its format together*, at the moment the
 * entry is committed: `23/09/2026` becomes the number 45358 wearing a date
 * format, `50%` becomes 0.5 wearing a percent format, `'007` stays the text
 * `007`. The value alone is not enough to describe that, which is why this
 * returns a small record rather than a `CellValue` — the caller applies the
 * format to the cell's style in the same edit that stores the value.
 *
 * The rule for formats is Excel's: an entry may *dress* a General cell, but it
 * never overrules a format someone chose. Typing `5` into a cell formatted as
 * currency leaves it currency, and typing a date into one formatted as Text
 * leaves the text alone.
 */
export interface ParsedInput {
  value: CellValue;
  /**
   * The number format this entry implies, when it implies one.
   *
   * Absent means "leave the cell's format alone" — not "General".
   */
  numberFormat?: string;
  /**
   * The entry began with an apostrophe, forcing text.
   *
   * Stored on the style rather than in the value because that is what it is in
   * a workbook file: `quotePrefix` is a cell-format flag, and the apostrophe is
   * not part of the text. `1` and `'1` hold different things — a number and the
   * string `1` — and this is what tells the formula bar to show the apostrophe
   * again when the cell is re-opened.
   */
  quotePrefix?: boolean;
}

/**
 * Excel's two-digit-year rule: `29` is 2029, `30` is 1930.
 *
 * A hard boundary rather than a sliding window, because a sliding one would
 * make a paper marked today and the same paper marked in ten years disagree.
 */
const CENTURY_BREAK = 30;

/** The earliest year with a serial: before 1900 Excel has no date at all. */
const MIN_YEAR = 1900;
const MAX_YEAR = 9999;

/**
 * `31/12/2024`, `31-12-2024`, `2024-12-31`, `31/12` — one separator, used twice.
 *
 * `.` is deliberately not a separator: `3.5` is a number, and reading it as the
 * third of May would turn every decimal typed into a date.
 */
const NUMERIC_DATE = /^(\d{1,4})([/-])(\d{1,2})(?:\2(\d{1,4}))?$/;

/** `31-Dec-2024`, `31 December 2024`, `Dec 31, 2024`. */
const DAY_FIRST_NAMED = /^(\d{1,2})[\s\-/]([A-Za-z]{3,9})(?:[\s\-/](\d{1,4}))?$/;
const MONTH_FIRST_NAMED = /^([A-Za-z]{3,9})[\s\-/](\d{1,2})(?:,?[\s\-/](\d{1,4}))?$/;

/** `14:30`, `2:05:30`, `9:15 PM`. */
const TIME = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?\s*(am|pm)?$/i;

/** `50%`, `-12.5 %`. */
const PERCENT = /^([+-]?(?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d+)?)\s*%$/;

/** `₹1,200`, `Rs. 45.50`, `₹ -30`. */
const CURRENCY = /^(?:₹|Rs\.?)\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d+)?)$/i;

/** `1,234` and `1,234.50`, but not `1,23` or `12,3456`. */
const GROUPED = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/**
 * Reads a typed entry.
 *
 * `currentFormat` is the format the cell already carries; it decides whether an
 * implied format is offered at all, and a Text-formatted cell short-circuits
 * everything — that is the whole point of formatting a column as Text before
 * pasting a list of account numbers into it.
 */
export function parseCellInput(input: string, currentFormat?: string): ParsedInput {
  if (input.length === 0) return { value: null };

  // The apostrophe wins over everything, including what looks like a number,
  // a date or an error value. That is why it exists.
  if (input.startsWith("'")) return { value: input.slice(1), quotePrefix: true };

  if (currentFormat === NUMBER_FORMATS.text) return { value: input };

  if (isErrorValue(input)) return { value: input };

  const upper = input.toUpperCase();
  if (upper === 'TRUE') return { value: true };
  if (upper === 'FALSE') return { value: false };

  const trimmed = input.trim();
  if (trimmed.length === 0) return { value: input };

  const dated = parseDateTime(trimmed);
  if (dated) return dress(dated.serial, dated.format, currentFormat);

  // A leading zero means the user wants text: `00123` is a reference number,
  // not one hundred and twenty-three. Checked after dates so that `01/03/2024`
  // is still the first of March.
  if (/^0[0-9]/.test(input)) return { value: input };

  const percent = PERCENT.exec(trimmed);
  if (percent?.[1] && /\d/.test(percent[1])) {
    return dress(Number(percent[1].replace(/,/g, '')) / 100, NUMBER_FORMATS.percent, currentFormat);
  }

  const currency = CURRENCY.exec(trimmed);
  if (currency?.[1] && /\d/.test(currency[1])) {
    const amount = Number(currency[1].replace(/,/g, ''));
    const format = currency[1].includes('.') ? NUMBER_FORMATS.currency : NUMBER_FORMATS.currencyWhole;
    return dress(amount, format, currentFormat);
  }

  if (GROUPED.test(trimmed)) {
    const amount = Number(trimmed.replace(/,/g, ''));
    // Grouping was typed, so grouping is what the cell should keep showing.
    const format = trimmed.includes('.') ? NUMBER_FORMATS.thousands : '#,##0';
    return dress(amount, format, currentFormat);
  }

  if (Number.isFinite(Number(trimmed))) return { value: Number(trimmed) };

  return { value: input };
}

/**
 * Offers a format only if the cell has not already been given one.
 *
 * Excel's behaviour, and the reason a candidate can format a column as
 * `₹#,##0` and then type plain numbers into it without the format bouncing
 * back to General on every entry.
 */
function dress(value: number, format: string, currentFormat: string | undefined): ParsedInput {
  const unformatted = currentFormat === undefined || currentFormat === '' || currentFormat === NUMBER_FORMATS.general;
  return unformatted ? { value, numberFormat: format } : { value };
}

interface DateTime {
  serial: number;
  format: string;
}

/**
 * A date, a time, or a date followed by a time.
 *
 * Returns null for anything it does not recognise: an entry that stays text is
 * recoverable, and a cell that left-aligns is the signal that it did. A missing
 * year means this year, as Excel does with `3/4`.
 */
function parseDateTime(text: string): DateTime | null {
  const date = parseDate(text);
  if (date !== null) return { serial: date, format: NUMBER_FORMATS.date };

  const time = parseTime(text);
  if (time !== null) return { serial: time, format: NUMBER_FORMATS.time };

  // `23/09/2026 14:30`: a date and a time, separated by whitespace.
  const split = text.search(/\s/);
  if (split === -1) return null;

  const both = parseDate(text.slice(0, split));
  const clock = parseTime(text.slice(split + 1).trim());
  if (both === null || clock === null) return null;

  return { serial: both + clock, format: NUMBER_FORMATS.dateTime };
}

function parseDate(text: string): number | null {
  const numeric = NUMERIC_DATE.exec(text);
  if (numeric) {
    const [, first = '', , second = '', third] = numeric;

    // `2024-12-31`: a four-digit leading field can only be a year.
    if (first.length === 4) {
      return third === undefined ? null : serialFor(Number(first), Number(second), Number(third));
    }

    // Day first, as every Indian keyboard and every Indian form has it.
    const year = third === undefined ? new Date().getUTCFullYear() : expandYear(third);
    return serialFor(year, Number(second), Number(first));
  }

  const dayFirst = DAY_FIRST_NAMED.exec(text);
  if (dayFirst) {
    const month = monthNumber(dayFirst[2] ?? '');
    if (month === null) return null;
    const year = dayFirst[3] === undefined ? new Date().getUTCFullYear() : expandYear(dayFirst[3]);
    return serialFor(year, month, Number(dayFirst[1]));
  }

  const monthFirst = MONTH_FIRST_NAMED.exec(text);
  if (monthFirst) {
    const month = monthNumber(monthFirst[1] ?? '');
    if (month === null) return null;
    const year = monthFirst[3] === undefined ? new Date().getUTCFullYear() : expandYear(monthFirst[3]);
    return serialFor(year, month, Number(monthFirst[2]));
  }

  return null;
}

/** A time of day as Excel stores it: the fraction of a day it is through. */
function parseTime(text: string): number | null {
  const match = TIME.exec(text);
  if (!match) return null;

  const [, hours = '', minutes = '', seconds, meridiem] = match;
  let hour = Number(hours);
  const minute = Number(minutes);
  const second = seconds === undefined ? 0 : Number(seconds);

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
  }

  if (hour > 23 || minute > 59 || second >= 60) return null;

  return (hour * 3600 + minute * 60 + second) / 86_400;
}

/**
 * The serial for a calendar date, or null if that date does not exist.
 *
 * The round-trip check is what rejects `31/02/2024`: `Date.UTC` happily rolls
 * it forward to 2 March, and a spreadsheet that accepted an impossible date by
 * quietly moving it is worse than one that left the text alone.
 */
function serialFor(year: number, month: number, day: number): number | null {
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return dateToSerial(date);
}

function expandYear(digits: string): number {
  const value = Number(digits);
  if (digits.length > 2) return value;
  return value < CENTURY_BREAK ? 2000 + value : 1900 + value;
}

/** `Dec`, `dec`, `December` — but not `De`, which could be several months. */
function monthNumber(name: string): number | null {
  const lower = name.toLowerCase();
  const index = MONTHS.findIndex((month) => month === lower || month.slice(0, 3) === lower);
  return index === -1 ? null : index + 1;
}

/**
 * Closes the brackets a pointed formula was left with.
 *
 * `=SUM(` then a drag leaves `=SUM(B2:B6`, because the user picked the range
 * instead of typing the closing bracket — which is exactly how Excel is used,
 * and Excel closes it for them on commit. Without this the most common way to
 * write SUM produces a parse error.
 *
 * Brackets inside a quoted string are text, not structure: `="(" & A1` is
 * balanced, and counting the quote's bracket would break it.
 */
export function completeFormula(input: string): string {
  let depth = 0;
  let quoted = false;

  for (const character of input) {
    if (character === '"') quoted = !quoted;
    else if (quoted) continue;
    else if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
  }

  // A negative depth means too many closing brackets — the user's error to see
  // and fix, not one to paper over by adding more.
  return depth > 0 ? input + ')'.repeat(depth) : input;
}
