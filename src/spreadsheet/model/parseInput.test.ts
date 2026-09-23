import { describe, expect, it } from 'vitest';
import { NUMBER_FORMATS, formatCellValue } from './format';
import { parseCellInput } from './parseInput';

/** What a cell would end up showing, which is what the candidate judges. */
function shown(input: string, currentFormat?: string): string {
  const parsed = parseCellInput(input, currentFormat);
  return formatCellValue(parsed.value, parsed.numberFormat ?? currentFormat);
}

describe('parseCellInput', () => {
  it('reads the plain types Excel reads', () => {
    expect(parseCellInput('')).toEqual({ value: null });
    expect(parseCellInput('42')).toEqual({ value: 42 });
    expect(parseCellInput('-3.5')).toEqual({ value: -3.5 });
    expect(parseCellInput('hello')).toEqual({ value: 'hello' });
    expect(parseCellInput('true')).toEqual({ value: true });
    expect(parseCellInput('#N/A')).toEqual({ value: '#N/A' });
  });

  it('keeps a decimal a decimal', () => {
    // The trap in day-first date parsing: a locale that reads `3.5` as the
    // third of May turns every decimal typed into a date.
    expect(parseCellInput('3.5')).toEqual({ value: 3.5 });
    expect(parseCellInput('1.12')).toEqual({ value: 1.12 });
  });

  describe('an apostrophe forces text', () => {
    it('stores the text without the apostrophe, and remembers it was forced', () => {
      expect(parseCellInput("'007")).toEqual({ value: '007', quotePrefix: true });
    });

    it('beats everything a bare entry would have been', () => {
      expect(parseCellInput("'42")).toEqual({ value: '42', quotePrefix: true });
      expect(parseCellInput("'23/09/2026").value).toBe('23/09/2026');
      expect(parseCellInput("'TRUE").value).toBe('TRUE');
      // Even a formula: `'=1+1` is how you show a formula rather than run it.
      expect(parseCellInput("'=1+1").value).toBe('=1+1');
    });

    it('leaves a leading zero alone without one, as a reference number', () => {
      expect(parseCellInput('00123')).toEqual({ value: '00123' });
    });
  });

  describe('dates', () => {
    it('reads a typed date as a serial wearing a date format', () => {
      // 45352 is the serial Excel stores for 1 March 2024.
      expect(parseCellInput('01/03/2024')).toEqual({
        value: 45352,
        numberFormat: NUMBER_FORMATS.date,
      });
      expect(shown('01/03/2024')).toBe('01-03-2024');
    });

    it('takes the separators and orders people actually type', () => {
      expect(shown('1-3-2024')).toBe('01-03-2024');
      expect(shown('2024-03-01')).toBe('01-03-2024');
      expect(shown('1-Mar-2024')).toBe('01-03-2024');
      expect(shown('1 March 2024')).toBe('01-03-2024');
      expect(shown('Mar 1, 2024')).toBe('01-03-2024');
    });

    it('follows Excel’s two-digit-year rule', () => {
      expect(shown('1/3/24')).toBe('01-03-2024');
      expect(shown('1/3/29')).toBe('01-03-2029');
      expect(shown('1/3/30')).toBe('01-03-1930');
    });

    it('fills in this year when none is typed', () => {
      const year = new Date().getUTCFullYear();
      expect(shown('1/3')).toBe(`01-03-${year}`);
    });

    it('leaves an impossible date as text rather than moving it', () => {
      // `Date.UTC` would roll 31 February forward to 2 March; a spreadsheet
      // that accepted an impossible date by quietly changing it is worse than
      // one that left the text alone.
      expect(parseCellInput('31/02/2024')).toEqual({ value: '31/02/2024' });
      expect(parseCellInput('1/13/2024')).toEqual({ value: '1/13/2024' });
      expect(parseCellInput('1/3/1850')).toEqual({ value: '1/3/1850' });
    });

    it('reads a time as the fraction of a day Excel stores', () => {
      expect(parseCellInput('06:00')).toEqual({ value: 0.25, numberFormat: NUMBER_FORMATS.time });
      expect(shown('14:30:15')).toBe('14:30:15');
      expect(shown('2:30 PM')).toBe('14:30:00');
      expect(parseCellInput('25:00')).toEqual({ value: '25:00' });
    });

    it('reads a date and a time together', () => {
      const parsed = parseCellInput('01/03/2024 14:30');
      expect(parsed.value).toBe(45352.604166666664);
      expect(parsed.numberFormat).toBe(NUMBER_FORMATS.dateTime);
      expect(shown('01/03/2024 14:30')).toBe('01-03-2024 14:30');
    });
  });

  describe('numbers that carry their own format', () => {
    it('reads a percentage as the fraction it is', () => {
      expect(parseCellInput('50%')).toEqual({ value: 0.5, numberFormat: NUMBER_FORMATS.percent });
      expect(shown('7.5%')).toBe('7.50%');
    });

    it('reads a typed rupee amount', () => {
      expect(shown('₹1,200')).toBe('₹1,200');
      expect(shown('Rs. 45.50')).toBe('₹45.50');
    });

    it('keeps the grouping someone typed', () => {
      expect(shown('1,234')).toBe('1,234');
      expect(shown('1,234.50')).toBe('1,234.50');
      // Not a grouped number: the separators are in the wrong places.
      expect(parseCellInput('1,23')).toEqual({ value: '1,23' });
    });
  });

  describe('a format the cell already has', () => {
    it('is not overruled by what gets typed into it', () => {
      // Typing plain numbers into a column formatted as currency must not
      // knock the format off cell by cell.
      expect(parseCellInput('5', NUMBER_FORMATS.currency)).toEqual({ value: 5 });
      expect(parseCellInput('50%', NUMBER_FORMATS.currency)).toEqual({ value: 0.5 });
      expect(parseCellInput('1/3/2024', NUMBER_FORMATS.number).value).toBe(45352);
    });

    it('is replaced when the cell is still General', () => {
      expect(parseCellInput('50%', NUMBER_FORMATS.general).numberFormat).toBe(NUMBER_FORMATS.percent);
      expect(parseCellInput('50%', '').numberFormat).toBe(NUMBER_FORMATS.percent);
    });

    it('stops all of it when the cell is formatted as Text', () => {
      // The reason anyone formats a column as Text before typing account
      // numbers into it.
      expect(parseCellInput('1/3/2024', NUMBER_FORMATS.text)).toEqual({ value: '1/3/2024' });
      expect(parseCellInput('42', NUMBER_FORMATS.text)).toEqual({ value: '42' });
      expect(parseCellInput('50%', NUMBER_FORMATS.text)).toEqual({ value: '50%' });
    });
  });
});
