import { describe, expect, it } from 'vitest';
import { DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, MAX_MERGE_CELLS, Worksheet } from './Worksheet';
import { DEFAULT_STYLE_ID } from './styles';
import { MAX_COLUMNS, MAX_ROWS } from './address';
import type { Cell } from './Cell';

/**
 * The sheet is where the performance promise of the whole editor lives: a
 * nominal seventeen billion cells, a few thousand of them real. These tests
 * guard the two ways that promise breaks — storing what is empty, and walking
 * what does not exist.
 */

const text = (value: string): Cell => ({ value, styleId: DEFAULT_STYLE_ID });

function sheet(): Worksheet {
  return new Worksheet('s1', 'Sheet1');
}

describe('cells', () => {
  it('stores and reads a cell', () => {
    const s = sheet();
    s.setCell(3, 1, text('hello'));

    expect(s.getValue(3, 1)).toBe('hello');
    expect(s.getValue(0, 0)).toBeNull();
    expect(s.cellCount).toBe(1);
  });

  it('stores nothing for a cell that is blank and unstyled', () => {
    // Otherwise pressing Delete grows the sheet, and the used range creeps
    // outwards over cells holding nothing.
    const s = sheet();
    s.setCell(5, 5, text('x'));
    s.setCell(5, 5, { value: null, styleId: DEFAULT_STYLE_ID });

    expect(s.cellCount).toBe(0);
  });

  it('keeps a blank cell that carries formatting', () => {
    // A yellow empty cell is a thing a user made on purpose.
    const s = sheet();
    s.setCell(5, 5, { value: null, styleId: 7 });

    expect(s.cellCount).toBe(1);
    expect(s.getCell(5, 5)?.styleId).toBe(7);
  });

  it('handles the far corner of the grid', () => {
    const s = sheet();
    s.setCell(MAX_ROWS - 1, MAX_COLUMNS - 1, text('corner'));

    expect(s.getValue(MAX_ROWS - 1, MAX_COLUMNS - 1)).toBe('corner');
    expect(s.usedRange()).toEqual({
      start: { row: MAX_ROWS - 1, col: MAX_COLUMNS - 1 },
      end: { row: MAX_ROWS - 1, col: MAX_COLUMNS - 1 },
    });
  });

  it('stays sparse under a scattered workload', () => {
    const s = sheet();
    for (let i = 0; i < 1_000; i += 1) s.setCell(i * 977, i * 13, text(`v${i}`));

    // 1,000 cells spread across ~977,000 rows: the map holds 1,000 entries.
    expect(s.cellCount).toBe(1_000);
  });
});

describe('usedRange', () => {
  it('is null for an empty sheet', () => {
    expect(sheet().usedRange()).toBeNull();
  });

  it('bounds everything written', () => {
    const s = sheet();
    s.setCell(2, 3, text('a'));
    s.setCell(9, 1, text('b'));

    expect(s.usedRange()).toEqual({ start: { row: 2, col: 1 }, end: { row: 9, col: 3 } });
  });

  it('shrinks back after the outermost cell is cleared', () => {
    // Growing on write is cheap; shrinking is deferred, but it must actually
    // happen or the scroll extent never comes back down.
    const s = sheet();
    s.setCell(1, 1, text('a'));
    s.setCell(500, 500, text('far'));
    s.setCell(500, 500, undefined);

    expect(s.usedRange()).toEqual({ start: { row: 1, col: 1 }, end: { row: 1, col: 1 } });
  });
});

describe('cellsInRow', () => {
  it('yields only occupied cells, in column order', () => {
    const s = sheet();
    s.setCell(4, 9, text('i'));
    s.setCell(4, 0, text('a'));
    s.setCell(4, 3, text('d'));

    expect([...s.cellsInRow(4)].map(([col]) => col)).toEqual([0, 3, 9]);
  });

  it('clips to the requested column window', () => {
    // This is what the viewport does: ask for the visible columns only.
    const s = sheet();
    for (const col of [0, 5, 10, 20]) s.setCell(1, col, text(`c${col}`));

    expect([...s.cellsInRow(1, 5, 10)].map(([col]) => col)).toEqual([5, 10]);
  });

  it('yields nothing for an untouched row without allocating a scan', () => {
    const s = sheet();
    s.setCell(0, 0, text('a'));

    expect([...s.cellsInRow(999_999)]).toEqual([]);
  });

  it('forgets a column once its cell is cleared', () => {
    const s = sheet();
    s.setCell(2, 4, text('x'));
    s.setCell(2, 4, undefined);

    expect([...s.cellsInRow(2)]).toEqual([]);
  });
});

describe('rows and columns', () => {
  it('falls back to the sheet defaults', () => {
    const s = sheet();

    expect(s.rowHeight(0)).toBe(DEFAULT_ROW_HEIGHT);
    expect(s.columnWidth(0)).toBe(DEFAULT_COLUMN_WIDTH);
  });

  it('reports a hidden row or column as zero-sized', () => {
    // The grid measures with these, so hidden has to mean zero here rather
    // than being special-cased at every call site.
    const s = sheet();
    s.setRowProps(3, { hidden: true, height: 40 });
    s.setColumnProps(2, { hidden: true });

    expect(s.rowHeight(3)).toBe(0);
    expect(s.columnWidth(2)).toBe(0);
  });

  it('restores the prior height when a row is unhidden', () => {
    const s = sheet();
    s.setRowProps(3, { height: 40 });
    s.setRowProps(3, { height: 40, hidden: true });
    s.setRowProps(3, { height: 40 });

    expect(s.rowHeight(3)).toBe(40);
  });
});

describe('merges', () => {
  it('covers every cell in the range and anchors at the top-left', () => {
    const s = sheet();
    expect(s.mergeCells({ start: { row: 1, col: 1 }, end: { row: 2, col: 3 } })).toBe(true);

    expect(s.mergeCovering(2, 3)?.start).toEqual({ row: 1, col: 1 });
    expect(s.isCovered(1, 1)).toBe(false); // the anchor holds the value
    expect(s.isCovered(2, 3)).toBe(true);
    expect(s.mergeCovering(0, 0)).toBeUndefined();
  });

  it('refuses to overlap an existing merge', () => {
    // Excel refuses too, and allowing it would make "which merge covers this
    // cell" ambiguous.
    const s = sheet();
    s.mergeCells({ start: { row: 0, col: 0 }, end: { row: 2, col: 2 } });

    expect(s.mergeCells({ start: { row: 2, col: 2 }, end: { row: 4, col: 4 } })).toBe(false);
    expect(s.mergedRanges()).toHaveLength(1);
  });

  it('refuses an implausibly large merge instead of indexing it', () => {
    // A malicious workbook can declare A1:XFD1048576; building a covered-cell
    // index for that exhausts memory before anything renders.
    const s = sheet();
    const whole = {
      start: { row: 0, col: 0 },
      end: { row: MAX_ROWS - 1, col: MAX_COLUMNS - 1 },
    };

    expect(s.mergeCells(whole)).toBe(false);
    expect(s.mergedRanges()).toHaveLength(0);
  });

  it('accepts a merge just inside the guard', () => {
    const s = sheet();
    const wide = { start: { row: 0, col: 0 }, end: { row: 0, col: MAX_COLUMNS - 1 } };

    expect(wide.end.col + 1).toBeLessThanOrEqual(MAX_MERGE_CELLS);
    expect(s.mergeCells(wide)).toBe(true);
  });

  it('unmerges without disturbing other merges', () => {
    // Ids are indexes into the merge list, so removal must not renumber.
    const s = sheet();
    s.mergeCells({ start: { row: 0, col: 0 }, end: { row: 0, col: 1 } });
    s.mergeCells({ start: { row: 5, col: 0 }, end: { row: 5, col: 1 } });

    expect(s.unmergeAt(0, 1)).toBe(true);

    expect(s.mergeCovering(0, 1)).toBeUndefined();
    expect(s.mergeCovering(5, 1)?.start).toEqual({ row: 5, col: 0 });
    expect(s.mergedRanges()).toHaveLength(1);
  });

  it('reports nothing to unmerge at a free cell', () => {
    expect(sheet().unmergeAt(0, 0)).toBe(false);
  });
});

describe('freeze', () => {
  it('records frozen rows and columns', () => {
    const s = sheet();
    s.freeze(1, 2);

    expect(s.frozen).toEqual({ rows: 1, columns: 2 });
  });

  it('clamps nonsense rather than trusting it', () => {
    const s = sheet();
    s.freeze(-5, 10 ** 9);

    expect(s.frozen.rows).toBe(0);
    expect(s.frozen.columns).toBe(MAX_COLUMNS);
  });
});
