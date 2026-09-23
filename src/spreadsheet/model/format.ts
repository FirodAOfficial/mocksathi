import { cellType, isErrorValue, type Cell, type CellValue } from './Cell';
import type { CellStyle } from './styles';
import type { TextAlignment } from '@/services/document/types';

/**
 * Turning a stored value into the text a cell shows.
 *
 * Excel's number-format language is large — section-separated positive /
 * negative / zero / text patterns, colour codes, conditions, locale-dependent
 * date tokens. This implements two families: the numeric codes the ribbon's
 * Number group can produce, and date/time codes built from Excel's `d`, `m`,
 * `y`, `h` and `s` tokens. Both are families rather than a fixed list because
 * the ribbon's Increase Decimal turns `#,##0.00` into `#,##0.000`, and a
 * question author can ask for `dd/mm/yy` as readily as for `dd-mm-yyyy`; a
 * switch over named constants shows those as raw serial numbers.
 *
 * A code outside both families falls back to General rather than being
 * half-applied — a wrongly formatted number reads as a wrong number.
 */

/** The number-format codes the Number group offers. */
export const NUMBER_FORMATS = {
  general: 'General',
  number: '0.00',
  thousands: '#,##0.00',
  percent: '0.00%',
  currency: '₹#,##0.00',
  /** Excel's Currency with the decimal places set to zero. */
  currencyWhole: '₹#,##0',
  date: 'dd-mm-yyyy',
  /** What typing a date *and* a time into one cell applies. */
  dateTime: 'dd-mm-yyyy hh:mm',
  time: 'hh:mm:ss',
  text: '@',
} as const;

export type NumberFormatName = keyof typeof NUMBER_FORMATS;

/**
 * How many digits General shows before switching to scientific notation.
 *
 * Excel's General fits the column and falls back to exponent form; without
 * column-aware measurement here, a fixed significant-digit budget is the
 * closest honest approximation.
 */
const GENERAL_SIGNIFICANT_DIGITS = 10;

/** Excel's epoch: day 1 is 1900-01-01, with its famous phantom 29 Feb 1900. */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

export function serialToDate(serial: number): Date {
  return new Date(EXCEL_EPOCH_UTC + Math.round(serial * MS_PER_DAY));
}

/**
 * The serial Excel stores for a date — the inverse of `serialToDate`.
 *
 * Exact from 1 March 1900 onwards. Before that, Excel's phantom 29 February
 * 1900 puts its serials a day ahead of any real calendar, so this pair is
 * self-consistent rather than Excel-compatible across those fifty-nine days,
 * which is the right trade: a date typed in and read back must not move.
 */
export function dateToSerial(date: Date): number {
  return (date.getTime() - EXCEL_EPOCH_UTC) / MS_PER_DAY;
}

/**
 * Numeric codes, as a family: an optional rupee sign, grouped or plain digits,
 * any number of decimal places, an optional trailing percent.
 */
const NUMERIC_CODE = /^(₹?)(#,##0|0)(?:\.(0+))?(%?)$/;

/**
 * Date and time codes, as a family.
 *
 * Recognised by their alphabet rather than by a list, so `dd/mm/yy`,
 * `d-mmm-yyyy` and `hh:mm AM/PM` all work. At least one of `y`, `d`, `h` or `s`
 * has to be present: a lone `m` is Excel's month-or-minute ambiguity with no
 * context to resolve it, and guessing would be worse than falling back.
 */
const DATE_CODE = /^(?:[ymdhs \t/:.\-]|am\/pm)*[ydhs](?:[ymdhs \t/:.\-]|am\/pm)*$/i;

export function isDateTimeFormat(format: string | undefined): boolean {
  return format !== undefined && format !== '' && DATE_CODE.test(format);
}

export function formatCellValue(value: CellValue, format: string | undefined): string {
  if (value === null) return '';
  if (isErrorValue(value)) return value;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';

  if (typeof value === 'string') return value;

  return formatNumber(value, format);
}

function formatNumber(value: number, format: string | undefined): string {
  if (!Number.isFinite(value)) return '#NUM!';

  switch (format) {
    case undefined:
    case '':
    case NUMBER_FORMATS.general:
      return general(value);

    case NUMBER_FORMATS.text:
      return String(value);

    default:
      break;
  }

  const numeric = NUMERIC_CODE.exec(format);
  if (numeric) {
    const [, currency = '', base = '0', decimals = '', percent = ''] = numeric;
    const scaled = percent ? value * 100 : value;
    const places = decimals.length;
    const body = base === '#,##0' ? grouped(scaled, places) : scaled.toFixed(places);
    return `${currency}${body}${percent}`;
  }

  if (isDateTimeFormat(format)) return formatDateCode(format, serialToDate(value));

  // An unrecognised code from a parsed workbook. General is a defined answer;
  // guessing at the code would produce a confidently wrong one.
  return general(value);
}

function general(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value);

  const rounded = Number(value.toPrecision(GENERAL_SIGNIFICANT_DIGITS));
  // `toPrecision` leaves trailing zeros; `String` of the re-parsed number drops
  // them, which is what General does.
  return String(rounded);
}

function grouped(value: number, decimals: number): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole = '0', fraction] = fixed.split('.');
  const withSeparators = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = value < 0 ? '-' : '';

  return fraction ? `${sign}${withSeparators}.${fraction}` : `${sign}${withSeparators}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/* -- Date codes ---------------------------------------------------------- */

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Splits a code into its tokens and the literal separators between them. */
const DATE_TOKENS = /(yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|am\/pm)/i;
const IS_DATE_TOKEN = /^(?:yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|am\/pm)$/;

/**
 * Renders a date through an Excel date code.
 *
 * The one subtlety is `m`: it means month, except between an hour and a second,
 * where it means minute. Excel resolves that from context and so does this —
 * getting it wrong turns `hh:mm` into the hour followed by the month.
 */
function formatDateCode(code: string, date: Date): string {
  const parts = code.split(DATE_TOKENS);
  const twelveHour = /am\/pm/i.test(code);

  return parts
    .map((part, index) => {
      const token = part.toLowerCase();

      switch (token) {
        case 'yyyy':
          return String(date.getUTCFullYear());
        case 'yy':
          return pad(date.getUTCFullYear() % 100);
        case 'mmmm':
          return MONTH_NAMES[date.getUTCMonth()] ?? '';
        case 'mmm':
          return (MONTH_NAMES[date.getUTCMonth()] ?? '').slice(0, 3);
        case 'mm':
        case 'm': {
          const value = isMinuteToken(parts, index) ? date.getUTCMinutes() : date.getUTCMonth() + 1;
          return token === 'mm' ? pad(value) : String(value);
        }
        case 'dddd':
          return DAY_NAMES[date.getUTCDay()] ?? '';
        case 'ddd':
          return (DAY_NAMES[date.getUTCDay()] ?? '').slice(0, 3);
        case 'dd':
          return pad(date.getUTCDate());
        case 'd':
          return String(date.getUTCDate());
        case 'hh':
        case 'h': {
          const raw = date.getUTCHours();
          const value = twelveHour ? raw % 12 || 12 : raw;
          return token === 'hh' ? pad(value) : String(value);
        }
        case 'ss':
          return pad(date.getUTCSeconds());
        case 's':
          return String(date.getUTCSeconds());
        case 'am/pm':
          return date.getUTCHours() < 12 ? 'AM' : 'PM';
        default:
          // A literal separator: `/`, `-`, `:` or a space.
          return part;
      }
    })
    .join('');
}

/** True when the `m` at `index` sits just after an hour or just before a second. */
function isMinuteToken(parts: string[], index: number): boolean {
  for (let before = index - 1; before >= 0; before -= 1) {
    const token = (parts[before] ?? '').toLowerCase();
    if (token === 'hh' || token === 'h') return true;
    if (IS_DATE_TOKEN.test(token)) break;
  }

  for (let after = index + 1; after < parts.length; after += 1) {
    const token = (parts[after] ?? '').toLowerCase();
    if (token === 'ss' || token === 's') return true;
    if (IS_DATE_TOKEN.test(token)) break;
  }

  return false;
}

/* -- Alignment ----------------------------------------------------------- */

/**
 * Where a value sits in its cell when the style says nothing.
 *
 * Excel's default alignment is a *type* signal, not decoration: a number that
 * suddenly left-aligns is how you spot that it was stored as text. So this is
 * derived from the value rather than stored on the style.
 */
export function defaultAlignment(cell: Cell | undefined): TextAlignment {
  switch (cellType(cell)) {
    case 'number':
      return 'right';
    case 'boolean':
    case 'error':
      return 'center';
    case 'formula':
      return typeof cell?.value === 'number' ? 'right' : 'left';
    default:
      return 'left';
  }
}

export function alignmentOf(cell: Cell | undefined, style: CellStyle): TextAlignment {
  return style.horizontalAlignment ?? defaultAlignment(cell);
}
