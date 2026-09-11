import { cellType, isErrorValue, type Cell, type CellValue } from './Cell';
import type { CellStyle } from './styles';
import type { TextAlignment } from '@/services/document/types';

/**
 * Turning a stored value into the text a cell shows.
 *
 * Excel's number-format language is large — section-separated positive /
 * negative / zero / text patterns, colour codes, conditions, locale-dependent
 * date tokens. This implements the codes the ribbon's Number group can
 * actually apply and nothing more, so what the UI offers and what the formatter
 * honours are the same set. A code that arrives from a parsed workbook and is
 * not recognised falls back to General rather than being half-applied — a
 * wrongly formatted number reads as a wrong number.
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

    case NUMBER_FORMATS.number:
      return value.toFixed(2);

    case NUMBER_FORMATS.thousands:
      return grouped(value, 2);

    case NUMBER_FORMATS.percent:
      return `${(value * 100).toFixed(2)}%`;

    case NUMBER_FORMATS.currency:
      return `₹${grouped(value, 2)}`;

    case NUMBER_FORMATS.currencyWhole:
      return `₹${grouped(value, 0)}`;

    case NUMBER_FORMATS.date:
      return formatDate(serialToDate(value));

    case NUMBER_FORMATS.time:
      return formatTime(serialToDate(value));

    case NUMBER_FORMATS.text:
      return String(value);

    default:
      // An unrecognised code from a parsed workbook. General is a defined
      // answer; guessing at the code would produce a confidently wrong one.
      return general(value);
  }
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

function formatDate(date: Date): string {
  return `${pad(date.getUTCDate())}-${pad(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`;
}

function formatTime(date: Date): string {
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

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
