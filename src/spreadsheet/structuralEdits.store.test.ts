import { describe, expect, it } from 'vitest';
import { WorkbookStore } from './WorkbookStore';

/**
 * Inserting, deleting and sorting through the real store, with the formula
 * engine running.
 *
 * The unit tests pin the transforms; these pin the thing that actually matters
 * to a candidate — that the numbers on the sheet are still right afterwards,
 * and that one undo puts everything back.
 */

/** Marks in B2:B6 with a total in B8, the shape most questions use. */
async function sheetWithTotal(): Promise<WorkbookStore> {
  const store = new WorkbookStore();
  await store.ensureEngine();

  store.setCellInput(0, 1, 'Marks');
  [85, 92, 67, 78, 88].forEach((mark, index) => store.setCellInput(index + 1, 1, String(mark)));
  store.setCellInput(7, 1, '=SUM(B2:B6)');

  return store;
}

const TOTAL = 410;

describe('inserting a row', () => {
  it('keeps the total correct and moves it down', async () => {
    const store = await sheetWithTotal();
    store.selection.selectCell({ row: 2, col: 1 });

    store.editStructure({ axis: 'row', at: 2, delta: 1 }, 'Insert Sheet Rows', 'test');

    expect(store.activeSheet().getCell(8, 1)?.formula).toBe('=SUM(B2:B7)');
    expect(store.activeSheet().getValue(8, 1)).toBe(TOTAL);
  });

  it('includes a number typed into the new row', async () => {
    // The range grew, so the new row is inside it — which is the whole reason
    // Excel widens the reference rather than leaving it alone.
    const store = await sheetWithTotal();
    store.editStructure({ axis: 'row', at: 2, delta: 1 }, 'Insert Sheet Rows', 'test');

    store.setCellInput(2, 1, '10');

    expect(store.activeSheet().getValue(8, 1)).toBe(TOTAL + 10);
  });

  it('undoes in one step', async () => {
    const store = await sheetWithTotal();
    store.editStructure({ axis: 'row', at: 2, delta: 1 }, 'Insert Sheet Rows', 'test');

    store.undo();

    expect(store.activeSheet().getCell(7, 1)?.formula).toBe('=SUM(B2:B6)');
    expect(store.activeSheet().getValue(7, 1)).toBe(TOTAL);
    // One step, not one per moved cell: the next undo is the edit before it.
    expect(store.commands.undoLabel()).not.toBe('Insert Sheet Rows');
  });
});

describe('deleting a row', () => {
  it('drops the row from the total', async () => {
    const store = await sheetWithTotal();

    store.editStructure({ axis: 'row', at: 2, delta: -1 }, 'Delete Sheet Rows', 'test');

    expect(store.activeSheet().getCell(6, 1)?.formula).toBe('=SUM(B2:B5)');
    expect(store.activeSheet().getValue(6, 1)).toBe(TOTAL - 92);
  });

  it('leaves #REF! where a formula pointed at the deleted row', async () => {
    // Silently repointing it at whatever moved up would be plausible and wrong.
    const store = await sheetWithTotal();
    store.setCellInput(9, 0, '=B3');

    store.editStructure({ axis: 'row', at: 2, delta: -1 }, 'Delete Sheet Rows', 'test');

    expect(store.activeSheet().getCell(8, 0)?.formula).toBe('=#REF!');
  });
});

describe('sorting the selection', () => {
  async function namesAndMarks(): Promise<WorkbookStore> {
    const store = new WorkbookStore();
    await store.ensureEngine();

    [
      ['Rahul', 85],
      ['Amit', 67],
      ['Priya', 92],
    ].forEach(([name, mark], row) => {
      store.setCellInput(row, 0, String(name));
      store.setCellInput(row, 1, String(mark));
    });

    return store;
  }

  it('moves whole rows, keeping each record together', async () => {
    const store = await namesAndMarks();
    store.selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 2, col: 1 } });

    expect(store.sortSelection('asc')).toBeNull();

    expect(store.activeSheet().getValue(0, 0)).toBe('Amit');
    expect(store.activeSheet().getValue(0, 1)).toBe(67);
    expect(store.activeSheet().getValue(2, 0)).toBe('Rahul');
  });

  it('undoes in one step', async () => {
    const store = await namesAndMarks();
    store.selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 2, col: 1 } });
    store.sortSelection('asc');

    store.undo();

    expect(store.activeSheet().getValue(0, 0)).toBe('Rahul');
  });

  it('refuses a range holding a formula, and says why', async () => {
    const store = await sheetWithTotal();
    store.selection.selectRange({ start: { row: 0, col: 1 }, end: { row: 7, col: 1 } });

    expect(store.sortSelection('asc')).toContain('formula');
    // Nothing moved.
    expect(store.activeSheet().getValue(1, 1)).toBe(85);
  });
});
