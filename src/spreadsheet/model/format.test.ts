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
