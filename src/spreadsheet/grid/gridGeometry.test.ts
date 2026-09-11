import { describe, expect, it } from 'vitest';
import { GridGeometry, MAX_SCROLL_PX, MIN_SCROLL_ROWS } from './gridGeometry';
import { DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, Worksheet } from '../model/Worksheet';
import { MAX_ROWS } from '../model/address';

/**
 * The arithmetic the grid's virtualization rests on. If any of this is wrong
 * the symptom is not a crash — it is cells drawn a few pixels from where the
 * mouse thinks they are, which is far harder to diagnose than a failure.
 */

function sheet(): Worksheet {
  return new Worksheet('sheet1', 'Sheet1');
}

describe('GridGeometry', () => {
  it('offsets by multiplication when nothing is resized', () => {
    const geometry = new GridGeometry(sheet());

    expect(geometry.offsetOfRow(0)).toBe(0);
    expect(geometry.offsetOfRow(1000)).toBe(1000 * DEFAULT_ROW_HEIGHT);
    expect(geometry.offsetOfColumn(10)).toBe(10 * DEFAULT_COLUMN_WIDTH);
  });

  it('accounts for resized rows above, and only those above', () => {
    const worksheet = sheet();
    worksheet.setRowProps(2, { height: 60 });
    worksheet.setRowProps(5, { height: 10 });
    const geometry = new GridGeometry(worksheet);

    // Rows 0 and 1 are default; row 2 starts where they end.
    expect(geometry.offsetOfRow(2)).toBe(2 * DEFAULT_ROW_HEIGHT);
    // Row 3 sits below the tall row 2.
    expect(geometry.offsetOfRow(3)).toBe(2 * DEFAULT_ROW_HEIGHT + 60);
    // Row 6 carries both deltas: +40 from row 2, -10 from row 5.
    expect(geometry.offsetOfRow(6)).toBe(6 * DEFAULT_ROW_HEIGHT + 40 - 10);
  });

  it('treats a hidden row as zero-height', () => {
    const worksheet = sheet();
    worksheet.setRowProps(1, { hidden: true });
    const geometry = new GridGeometry(worksheet);

    expect(geometry.rowHeight(1)).toBe(0);
    expect(geometry.offsetOfRow(2)).toBe(DEFAULT_ROW_HEIGHT);
  });

  it('maps a pixel back to the row it lands in', () => {
    const worksheet = sheet();
    worksheet.setRowProps(3, { height: 100 });
    const geometry = new GridGeometry(worksheet);

    // Round-trip every row: the hit-test must invert the offset exactly, or
    // clicks land on a neighbour near a resized row.
    for (let row = 0; row < 20; row += 1) {
      const top = geometry.offsetOfRow(row);
      expect(geometry.rowAt(top)).toBe(row);
      expect(geometry.rowAt(top + geometry.rowHeight(row) - 1)).toBe(row);
    }
  });

  it('finds a far row without walking to it', () => {
    const geometry = new GridGeometry(sheet(), { row: 500_000, col: 0 });

    expect(geometry.rowAt(500_000 * DEFAULT_ROW_HEIGHT)).toBe(500_000);
  });

  describe('scroll extent', () => {
    it('covers the used range plus a buffer, not the whole grid', () => {
      const worksheet = sheet();
      worksheet.setCell(40, 2, { value: 1, styleId: 0 });
      const geometry = new GridGeometry(worksheet);

      expect(geometry.scrollRows).toBeGreaterThan(40);
      expect(geometry.scrollRows).toBeLessThan(MAX_ROWS);
    });

    it('gives a blank sheet somewhere to scroll', () => {
      expect(new GridGeometry(sheet()).scrollRows).toBeGreaterThanOrEqual(MIN_SCROLL_ROWS);
    });

    it('extends to wherever the user has navigated', () => {
      const geometry = new GridGeometry(sheet(), { row: 9_000, col: 0 });

      expect(geometry.scrollRows).toBeGreaterThan(9_000);
    });

    it('stays under the height a browser can actually scroll', () => {
      // Firefox stops mapping the scrollbar to content past ~17.9M pixels. A
      // full-grid extent is 21M, so the bottom of the sheet would be
      // unreachable and the thumb position would be a lie.
      const geometry = new GridGeometry(sheet(), { row: MAX_ROWS - 1, col: 0 });

      expect(geometry.totalHeight()).toBeLessThanOrEqual(MAX_SCROLL_PX);
    });
  });

  describe('visibleWindow', () => {
    it('returns a bounded window regardless of how far down we are', () => {
      const geometry = new GridGeometry(sheet(), { row: 400_000, col: 0 });
      const window = geometry.visibleWindow(0, 400_000 * DEFAULT_ROW_HEIGHT, 1200, 600);

      // 600px of 20px rows is 30, plus overscan at both edges — the hard gate
      // from the plan is that this never scales with the sheet.
      expect(window.lastRow - window.firstRow).toBeLessThan(40);
      expect(window.firstRow).toBeGreaterThan(399_000);
    });

    it('never runs past the scrollable area', () => {
      const geometry = new GridGeometry(sheet());
      const window = geometry.visibleWindow(0, 0, 200, 200);

      expect(window.firstRow).toBe(0);
      expect(window.lastRow).toBeLessThanOrEqual(geometry.scrollRows - 1);
      expect(window.lastColumn).toBeLessThanOrEqual(geometry.scrollColumns - 1);
    });
  });

  describe('scrollToShow', () => {
    it('does nothing when the cell is already visible', () => {
      const geometry = new GridGeometry(sheet());

      expect(geometry.scrollToShow({ row: 2, col: 1 }, 0, 0, 800, 400)).toBeNull();
    });

    it('scrolls the minimum distance to reveal a cell below the fold', () => {
      const geometry = new GridGeometry(sheet());
      const scrolled = geometry.scrollToShow({ row: 30, col: 0 }, 0, 0, 800, 400);

      // Row 30 ends at 620px; a 400px viewport must sit at 220 to show it.
      expect(scrolled).toEqual({ left: 0, top: 31 * DEFAULT_ROW_HEIGHT - 400 });
    });

    it('scrolls back up for a cell above the fold', () => {
      const geometry = new GridGeometry(sheet());
      const scrolled = geometry.scrollToShow({ row: 5, col: 0 }, 0, 1000, 800, 400);

      expect(scrolled?.top).toBe(5 * DEFAULT_ROW_HEIGHT);
    });
  });

  it('measures the rectangle a range covers', () => {
    const geometry = new GridGeometry(sheet());
    const rect = geometry.rectOf({ start: { row: 1, col: 1 }, end: { row: 2, col: 3 } });

    expect(rect).toEqual({
      left: DEFAULT_COLUMN_WIDTH,
      top: DEFAULT_ROW_HEIGHT,
      width: 3 * DEFAULT_COLUMN_WIDTH,
      height: 2 * DEFAULT_ROW_HEIGHT,
    });
  });
});
