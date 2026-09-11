import { describe, expect, it } from 'vitest';
import {
  MAX_COLUMNS,
  MAX_ROWS,
  cellKey,
  columnToLabel,
  eachAddress,
  formatAddress,
  formatRange,
  formatSheetPrefix,
  keyToAddress,
  labelToColumn,
  normaliseRange,
  parseCellReference,
  parseRangeReference,
  rangeCellCount,
  rangeContains,
  splitSheetReference,
  translateReference,
} from './address';

/**
 * Addressing is the foundation every other part of the engine stands on: the
 * grid, the formula parser, copy/paste and the fill handle all convert through
 * here. An off-by-one in this file is an off-by-one everywhere, and it would
 * show up as formulas quietly reading the wrong cell rather than as a crash.
 */

describe('column labels', () => {
  it('follows Excel’s bijective base-26', () => {
    // The interesting cases are the carries: plain base-26 gets 26 wrong.
    expect(columnToLabel(0)).toBe('A');
    expect(columnToLabel(25)).toBe('Z');
    expect(columnToLabel(26)).toBe('AA');
    expect(columnToLabel(51)).toBe('AZ');
    expect(columnToLabel(52)).toBe('BA');
    expect(columnToLabel(701)).toBe('ZZ');
    expect(columnToLabel(702)).toBe('AAA');
    expect(columnToLabel(MAX_COLUMNS - 1)).toBe('XFD');
  });

  it('round-trips every label back to its index', () => {
    for (const col of [0, 25, 26, 51, 52, 701, 702, 1000, MAX_COLUMNS - 1]) {
      expect(labelToColumn(columnToLabel(col))).toBe(col);
    }
  });

  it('is case-insensitive on the way in', () => {
    expect(labelToColumn('aa')).toBe(26);
  });

  it('rejects labels off the end of the grid', () => {
    expect(labelToColumn('XFE')).toBeNull();
    expect(labelToColumn('ZZZ')).toBeNull();
    expect(labelToColumn('')).toBeNull();
    expect(labelToColumn('A1')).toBeNull();
    expect(() => columnToLabel(MAX_COLUMNS)).toThrow(RangeError);
  });
});

describe('cell references', () => {
  it('reads the four anchor forms', () => {
    expect(parseCellReference('A1')).toEqual({
      row: 0,
      col: 0,
      anchor: { colAbsolute: false, rowAbsolute: false },
    });
    expect(parseCellReference('$A$1')?.anchor).toEqual({ colAbsolute: true, rowAbsolute: true });
    expect(parseCellReference('A$1')?.anchor).toEqual({ colAbsolute: false, rowAbsolute: true });
    expect(parseCellReference('$A1')?.anchor).toEqual({ colAbsolute: true, rowAbsolute: false });
  });

  it('converts to zero-based row and column', () => {
    expect(parseCellReference('B4')).toMatchObject({ row: 3, col: 1 });
    expect(parseCellReference('XFD1048576')).toMatchObject({
      row: MAX_ROWS - 1,
      col: MAX_COLUMNS - 1,
    });
  });

  it('returns null rather than throwing on partial input', () => {
    // The name box parses on every keystroke; "A" on the way to "A1" is not an
    // error worth an exception.
    for (const text of ['', 'A', '1', 'A0', 'A1048577', 'XFE1', '$', 'Sheet1']) {
      expect(parseCellReference(text)).toBeNull();
    }
  });

  it('formats back, restoring the dollars', () => {
    expect(formatAddress({ row: 3, col: 1 })).toBe('B4');
    expect(formatAddress({ row: 0, col: 0 }, { colAbsolute: true, rowAbsolute: true })).toBe('$A$1');
    expect(formatAddress({ row: 0, col: 0 }, { colAbsolute: false, rowAbsolute: true })).toBe('A$1');
  });
});

describe('sheet qualification', () => {
  it('splits a plain sheet name', () => {
    expect(splitSheetReference('Sheet2!A1')).toEqual({ sheet: 'Sheet2', rest: 'A1' });
  });

  it('splits a quoted sheet name containing a space', () => {
    expect(splitSheetReference("'Sales Data'!B12")).toEqual({ sheet: 'Sales Data', rest: 'B12' });
  });

  it('unescapes a doubled quote, as Excel writes it', () => {
    expect(splitSheetReference("'Bob''s Sheet'!A1")).toEqual({
      sheet: "Bob's Sheet",
      rest: 'A1',
    });
  });

  it('leaves an unqualified reference alone', () => {
    expect(splitSheetReference('A1')).toEqual({ rest: 'A1' });
  });

  it('quotes a name on the way out only when it needs it', () => {
    expect(formatSheetPrefix('Sheet1')).toBe('Sheet1!');
    expect(formatSheetPrefix('Sales Data')).toBe("'Sales Data'!");
    expect(formatSheetPrefix("Bob's")).toBe("'Bob''s'!");
  });
});

describe('ranges', () => {
  it('reads a rectangle', () => {
    const range = parseRangeReference('A1:C10');
    expect(range?.start).toMatchObject({ row: 0, col: 0 });
    expect(range?.end).toMatchObject({ row: 9, col: 2 });
  });

  it('treats a single cell as a one-cell range', () => {
    // So no caller has to branch on "cell or range" — everything wants a
    // rectangle.
    const range = parseRangeReference('B2');
    expect(range?.start).toEqual(range?.end);
    expect(rangeCellCount(range!)).toBe(1);
  });

  it('reads whole columns and rows', () => {
    const column = parseRangeReference('C:C');
    expect(column?.spans).toBe('column');
    expect(column?.start).toMatchObject({ row: 0, col: 2 });
    expect(column?.end).toMatchObject({ row: MAX_ROWS - 1, col: 2 });

    const row = parseRangeReference('5:5');
    expect(row?.spans).toBe('row');
    expect(row?.start).toMatchObject({ row: 4, col: 0 });
    expect(row?.end).toMatchObject({ row: 4, col: MAX_COLUMNS - 1 });
  });

  it('carries the sheet through', () => {
    expect(parseRangeReference("'Sales Data'!A1:B2")?.sheet).toBe('Sales Data');
  });

  it('orders the corners however they were typed', () => {
    // Dragging a selection upwards produces this internally, and a user can
    // type it directly.
    const range = parseRangeReference('C10:A1');
    expect(range?.start).toMatchObject({ row: 0, col: 0 });
    expect(range?.end).toMatchObject({ row: 9, col: 2 });
  });

  it('round-trips through formatRange', () => {
    for (const text of ['A1', 'A1:C10', '$A$1:$C$10', 'C:C', '5:5', "'Sales Data'!A1:B2"]) {
      expect(formatRange(parseRangeReference(text)!)).toBe(text);
    }
  });

  it('answers containment', () => {
    const range = normaliseRange(parseRangeReference('B2:D5')!);
    expect(rangeContains(range, { row: 2, col: 2 })).toBe(true);
    expect(rangeContains(range, { row: 0, col: 0 })).toBe(false);
    expect(rangeContains(range, { row: 5, col: 3 })).toBe(false);
  });

  it('walks a range in reading order without materialising it', () => {
    const walked = [...eachAddress(parseRangeReference('A1:B2')!)];
    expect(walked).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);
  });
});

describe('cell keys', () => {
  it('round-trips every corner of the grid', () => {
    for (const address of [
      { row: 0, col: 0 },
      { row: 0, col: MAX_COLUMNS - 1 },
      { row: MAX_ROWS - 1, col: 0 },
      { row: MAX_ROWS - 1, col: MAX_COLUMNS - 1 },
      { row: 12_345, col: 678 },
    ]) {
      expect(keyToAddress(cellKey(address.row, address.col))).toEqual(address);
    }
  });

  it('stays inside the integers a double represents exactly', () => {
    // 35 bits: lossless. If this ever exceeded 2^53 the keys would collide and
    // cells would silently overwrite each other.
    expect(cellKey(MAX_ROWS - 1, MAX_COLUMNS - 1)).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });

  it('never collides between distinct in-grid addresses', () => {
    // The packing is only injective while the column stays inside the grid —
    // `cellKey(0, MAX_COLUMNS)` would alias `cellKey(1, 0)`. That is a
    // precondition, not a bug: columns are validated at the parse boundary and
    // never reach here out of range.
    const seen = new Map<number, string>();
    for (const row of [0, 1, 2, 999, MAX_ROWS - 1]) {
      for (const col of [0, 1, 2, 999, MAX_COLUMNS - 1]) {
        const key = cellKey(row, col);
        const label = `${row},${col}`;
        expect(seen.get(key), `${label} collided with ${seen.get(key)}`).toBeUndefined();
        seen.set(key, label);
      }
    }
  });
});

describe('translateReference', () => {
  it('moves a relative reference by the distance the formula moved', () => {
    // =B1 copied from A1 to A2 must become =B2.
    const moved = translateReference(parseCellReference('B1')!, 1, 0);
    expect(formatAddress(moved!, moved!.anchor)).toBe('B2');
  });

  it('pins whatever the dollars pin', () => {
    const absolute = translateReference(parseCellReference('$C$1')!, 5, 5);
    expect(formatAddress(absolute!, absolute!.anchor)).toBe('$C$1');

    const rowPinned = translateReference(parseCellReference('C$1')!, 5, 5)!;
    expect(formatAddress(rowPinned, rowPinned.anchor)).toBe('H$1');

    const colPinned = translateReference(parseCellReference('$C1')!, 5, 5)!;
    expect(formatAddress(colPinned, colPinned.anchor)).toBe('$C6');
  });

  it('reports a reference pushed off the grid instead of clamping it', () => {
    // Clamping would change the formula's meaning silently; the caller renders
    // this as #REF!.
    expect(translateReference(parseCellReference('A1')!, -1, 0)).toBeNull();
    expect(translateReference(parseCellReference('A1')!, 0, -1)).toBeNull();
    expect(translateReference(parseCellReference('XFD1')!, 0, 1)).toBeNull();
  });
});
