import { describe, expect, it } from 'vitest';
import { NUMBER_FORMATS, alignmentOf, formatCellValue, serialToDate } from './format';
import type { Cell } from './Cell';

function cell(value: Cell['value'], formula?: string): Cell {
  return formula === undefined ? { value, styleId: 0 } : { value, formula, styleId: 0 };
}

describe('formatCellValue', () => {
  it('shows an integer as typed', () => {
    expect(formatCellValue(42, undefined)).toBe('42');
    expect(formatCellValue(-7, 'General')).toBe('-7');
  });

  it('does not show floating-point noise', () => {
    // 0.1 + 0.2 is 0.30000000000000004; a spreadsheet that showed that would
    // be correct and useless.
    expect(formatCellValue(0.1 + 0.2, undefined)).toBe('0.3');
  });

  it('applies the codes the Number group offers', () => {
    expect(formatCellValue(1234.5, NUMBER_FORMATS.number)).toBe('1234.50');
    expect(formatCellValue(1234.5, NUMBER_FORMATS.thousands)).toBe('1,234.50');
    expect(formatCellValue(-1234.5, NUMBER_FORMATS.thousands)).toBe('-1,234.50');
    expect(formatCellValue(0.075, NUMBER_FORMATS.percent)).toBe('7.50%');
    expect(formatCellValue(1234.5, NUMBER_FORMATS.currency)).toBe('₹1,234.50');
  });

  it('honours the codes the ribbon builds by adding and removing decimals', () => {
    // Increase Decimal turns `#,##0.00` into `#,##0.000`, and Decrease takes it
    // all the way to `#,##0`. A formatter that only knew the named constants
    // would drop the grouping the moment the last decimal went.
    expect(formatCellValue(1234.5, '#,##0')).toBe('1,235');
    expect(formatCellValue(1234.5678, '#,##0.000')).toBe('1,234.568');
    expect(formatCellValue(1234.5, '0')).toBe('1235');
    expect(formatCellValue(1234.5, '₹#,##0.0')).toBe('₹1,234.5');
  });

  it('applies date and time codes token by token', () => {
    // 45352.604166… is 1 March 2024 at 14:30, the value typing that produces.
    const stamp = 45352 + (14 * 60 + 30) / 1440;

    expect(formatCellValue(stamp, NUMBER_FORMATS.date)).toBe('01-03-2024');
    expect(formatCellValue(stamp, NUMBER_FORMATS.dateTime)).toBe('01-03-2024 14:30');
    expect(formatCellValue(stamp, 'dd/mm/yy')).toBe('01/03/24');
    expect(formatCellValue(stamp, 'd-mmm-yyyy')).toBe('1-Mar-2024');
    expect(formatCellValue(stamp, 'dddd')).toBe('Friday');
    expect(formatCellValue(stamp, 'h:mm AM/PM')).toBe('2:30 PM');
  });

  it('tells a month from a minute the way Excel does', () => {
    // The same two letters: `mm` is the month in `dd-mm-yyyy` and the minute in
    // `hh:mm`, decided by what sits beside it.
    const stamp = 45352 + (14 * 60 + 30) / 1440;

    expect(formatCellValue(stamp, 'yyyy-mm-dd')).toBe('2024-03-01');
    expect(formatCellValue(stamp, 'hh:mm:ss')).toBe('14:30:00');
    // A code of nothing but `mm` has neither beside it, so it is not read as a
    // date code at all — General is the honest answer to an ambiguous one.
    expect(formatCellValue(stamp, 'mm')).toBe('45352.60417');
  });

  it('falls back to General for a code it does not implement', () => {
    // Half-applying an unknown code would produce a confidently wrong number.
    expect(formatCellValue(1234.5, '[Red]0.0;;;')).toBe('1234.5');
  });

  it('renders booleans and errors as Excel does', () => {
    expect(formatCellValue(true, undefined)).toBe('TRUE');
    expect(formatCellValue('#DIV/0!', undefined)).toBe('#DIV/0!');
    expect(formatCellValue(null, undefined)).toBe('');
  });

  it('reads a date serial from Excel’s epoch', () => {
    // 45352 is 1 March 2024 — the value Excel stores for that date.
    expect(serialToDate(45352).toISOString().slice(0, 10)).toBe('2024-03-01');
    expect(formatCellValue(45352, NUMBER_FORMATS.date)).toBe('01-03-2024');
  });
});

describe('alignmentOf', () => {
  it('right-aligns numbers and left-aligns text, as the type signal Excel uses', () => {
    expect(alignmentOf(cell(42), {})).toBe('right');
    expect(alignmentOf(cell('42'), {})).toBe('left');
    expect(alignmentOf(cell(true), {})).toBe('center');
    expect(alignmentOf(cell('#N/A'), {})).toBe('center');
  });

  it('follows a formula’s computed type', () => {
    expect(alignmentOf(cell(30, '=SUM(A1:A2)'), {})).toBe('right');
    expect(alignmentOf(cell('abc', '=A1&"bc"'), {})).toBe('left');
  });

  it('lets an explicit alignment win', () => {
    expect(alignmentOf(cell(42), { horizontalAlignment: 'center' })).toBe('center');
  });
});
