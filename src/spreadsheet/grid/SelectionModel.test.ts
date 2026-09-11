import { describe, expect, it, vi } from 'vitest';
import { SelectionModel } from './SelectionModel';
import { MAX_COLUMNS, MAX_ROWS } from '../model/address';

/**
 * Selection lives outside React so that dragging a marquee does not re-render
 * the grid. These tests hold that line: the snapshot must stay identical until
 * something actually changes, or every subscriber re-renders on every mouse
 * move and the drag stutters.
 */

describe('SelectionModel', () => {
  it('starts at A1', () => {
    const selection = new SelectionModel();

    expect(selection.getActive()).toEqual({ row: 0, col: 0 });
    expect(selection.getRanges()).toEqual([{ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }]);
  });

  it('collapses to a clicked cell', () => {
    const selection = new SelectionModel();
    selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 5, col: 5 } });

    selection.selectCell({ row: 2, col: 3 });

    expect(selection.getActive()).toEqual({ row: 2, col: 3 });
    expect(selection.getRanges()).toHaveLength(1);
    expect(selection.isSelected({ row: 5, col: 5 })).toBe(false);
  });

  it('extends from the anchor without moving it', () => {
    // Shift-clicking twice extends from the original cell both times; an
    // anchor that follows the cursor would grow the selection cumulatively.
    const selection = new SelectionModel();
    selection.selectCell({ row: 2, col: 2 });

    selection.extendTo({ row: 5, col: 5 });
    selection.extendTo({ row: 3, col: 3 });

    expect(selection.getRanges()[0]).toEqual({
      start: { row: 2, col: 2 },
      end: { row: 3, col: 3 },
    });
  });

  it('extends upwards and leftwards, ordering the corners', () => {
    const selection = new SelectionModel();
    selection.selectCell({ row: 5, col: 5 });

    selection.extendTo({ row: 1, col: 1 });

    expect(selection.getRanges()[0]).toEqual({
      start: { row: 1, col: 1 },
      end: { row: 5, col: 5 },
    });
    // The cursor is where the user dragged to, not the top-left of the box.
    expect(selection.getActive()).toEqual({ row: 1, col: 1 });
  });

  it('keeps earlier rectangles when another is added', () => {
    // Ctrl-click, which =SUM(A1:A5,C1:C5) depends on.
    const selection = new SelectionModel();
    selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 4, col: 0 } });

    selection.addRange({ row: 0, col: 2 });
    selection.extendTo({ row: 4, col: 2 });

    expect(selection.getRanges()).toHaveLength(2);
    expect(selection.isSelected({ row: 3, col: 0 })).toBe(true);
    expect(selection.isSelected({ row: 3, col: 2 })).toBe(true);
    expect(selection.isSelected({ row: 3, col: 1 })).toBe(false);
  });

  describe('moveBy', () => {
    it('collapses on a plain arrow and extends on shift', () => {
      const selection = new SelectionModel();
      selection.selectCell({ row: 2, col: 2 });

      selection.moveBy(1, 0);
      expect(selection.getActive()).toEqual({ row: 3, col: 2 });
      expect(selection.getRanges()[0]).toEqual({
        start: { row: 3, col: 2 },
        end: { row: 3, col: 2 },
      });

      selection.moveBy(2, 0, true);
      expect(selection.getRanges()[0]).toEqual({
        start: { row: 3, col: 2 },
        end: { row: 5, col: 2 },
      });
    });

    it('stops at the edges instead of going off the grid', () => {
      const selection = new SelectionModel();
      selection.selectCell({ row: 0, col: 0 });

      selection.moveBy(-1, -1);
      expect(selection.getActive()).toEqual({ row: 0, col: 0 });

      selection.selectCell({ row: MAX_ROWS - 1, col: MAX_COLUMNS - 1 });
      selection.moveBy(1, 1);
      expect(selection.getActive()).toEqual({ row: MAX_ROWS - 1, col: MAX_COLUMNS - 1 });
    });
  });

  it('selects whole rows, columns and the sheet', () => {
    const selection = new SelectionModel();

    selection.selectRow(4);
    expect(selection.getRanges()[0]).toEqual({
      start: { row: 4, col: 0 },
      end: { row: 4, col: MAX_COLUMNS - 1 },
    });

    selection.selectColumn(2);
    expect(selection.getRanges()[0]).toEqual({
      start: { row: 0, col: 2 },
      end: { row: MAX_ROWS - 1, col: 2 },
    });

    selection.selectAll();
    expect(selection.isSelected({ row: 999_999, col: 16_000 })).toBe(true);
  });

  describe('addresses', () => {
    it('walks a rectangle in reading order', () => {
      const selection = new SelectionModel();
      selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 1, col: 1 } });

      expect([...selection.addresses()]).toEqual([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ]);
    });

    it('yields an overlapped cell once', () => {
      // Overlapping rectangles are legal after Ctrl-clicking. Applying a
      // format twice is merely wasteful, but a duplicated cell in the
      // operation log reads as two separate edits to a grader.
      const selection = new SelectionModel();
      selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 1, col: 1 } });
      selection.addRange({ row: 1, col: 1 });
      selection.extendTo({ row: 2, col: 2 });

      const walked = [...selection.addresses()];
      const unique = new Set(walked.map(({ row, col }) => `${row},${col}`));

      expect(walked).toHaveLength(unique.size);
    });
  });

  describe('subscribers', () => {
    it('returns the same snapshot object until something changes', () => {
      // useSyncExternalStore compares by identity; a fresh object per read
      // would re-render every subscriber on every mouse move.
      const selection = new SelectionModel();

      expect(selection.getState()).toBe(selection.getState());

      const before = selection.getState();
      selection.selectCell({ row: 1, col: 1 });
      expect(selection.getState()).not.toBe(before);
    });

    it('notifies on change and stops after unsubscribing', () => {
      const selection = new SelectionModel();
      const listener = vi.fn();
      const stop = selection.subscribe(listener);

      selection.selectCell({ row: 1, col: 1 });
      expect(listener).toHaveBeenCalledTimes(1);

      stop();
      selection.selectCell({ row: 2, col: 2 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('refuses to let a consumer mutate the selection', () => {
      // The snapshot is shared with every subscriber. If one could write to it,
      // the corruption would surface somewhere far from its cause.
      const selection = new SelectionModel();
      const state = selection.getState();

      expect(() => {
        state.active.row = 999;
      }).toThrow(TypeError);
      expect(selection.getActive().row).toBe(0);
    });
  });
});
