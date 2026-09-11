import { describe, expect, it } from 'vitest';
import { WorkbookStore } from './WorkbookStore';
import { blankSnapshot, workbookFromSnapshot } from './model/snapshot';

/**
 * The store end to end, against the real calculation engine rather than a stub
 * — the point of these is that `=SUM(A1:A2)` genuinely computes 30, and that
 * editing A1 moves it, so "the Excel editor calculates" is a checked claim.
 */

async function storeWithEngine(): Promise<WorkbookStore> {
  const store = new WorkbookStore();
  await store.ensureEngine();
  return store;
}

describe('WorkbookStore', () => {
  it('coerces typed input the way Excel does', () => {
    const store = new WorkbookStore();
    const sheet = store.activeSheet();

    store.setCellInput(0, 0, '42');
    store.setCellInput(0, 1, 'Total');
    store.setCellInput(0, 2, 'TRUE');
    store.setCellInput(0, 3, '00123');

    expect(sheet.getValue(0, 0)).toBe(42);
    expect(sheet.getValue(0, 1)).toBe('Total');
    expect(sheet.getValue(0, 2)).toBe(true);
    expect(sheet.getValue(0, 3)).toBe('00123');
  });

  it('shows the formula source in the formula bar and the value in the cell', async () => {
    const store = await storeWithEngine();

    store.setCellInput(0, 0, '10');
    store.setCellInput(1, 0, '20');
    store.setCellInput(2, 0, '=SUM(A1:A2)');

    expect(store.activeSheet().getValue(2, 0)).toBe(30);
    expect(store.editText(2, 0)).toBe('=SUM(A1:A2)');
  });

  it('recalculates dependents when a precedent changes', async () => {
    const store = await storeWithEngine();
    const sheet = store.activeSheet();

    store.setCellInput(0, 0, '10');
    store.setCellInput(1, 0, '20');
    store.setCellInput(2, 0, '=SUM(A1:A2)');
    store.setCellInput(3, 0, '=A3*2');

    expect(sheet.getValue(3, 0)).toBe(60);

    store.setCellInput(0, 0, '30');

    expect(sheet.getValue(2, 0)).toBe(50);
    expect(sheet.getValue(3, 0)).toBe(100);
  });

  it('reports a circular reference rather than hanging', async () => {
    const store = await storeWithEngine();

    store.setCellInput(0, 0, '=B1');
    store.setCellInput(0, 1, '=A1');

    expect(store.isCircular(store.activeSheet().id, 0, 0)).toBe(true);
    expect(store.activeSheet().getValue(0, 0)).toBe('#REF!');
  });

  it('puts an Excel error value in the cell rather than throwing', async () => {
    const store = await storeWithEngine();

    store.setCellInput(0, 0, '=1/0');

    expect(store.activeSheet().getValue(0, 0)).toBe('#DIV/0!');
  });

  it('takes a value without the engine loaded at all', () => {
    // The grid must work before the formula library has been fetched.
    const store = new WorkbookStore();
    store.setCellInput(0, 0, '5');

    expect(store.activeSheet().getValue(0, 0)).toBe(5);
    expect(store.getCalcState()).toBe('idle');
  });

  describe('undo', () => {
    it('restores the previous value and recalculates', async () => {
      const store = await storeWithEngine();
      const sheet = store.activeSheet();

      store.setCellInput(0, 0, '10');
      store.setCellInput(1, 0, '=A1*3');
      store.setCellInput(0, 0, '20');

      expect(sheet.getValue(1, 0)).toBe(60);

      store.undo();

      expect(sheet.getValue(0, 0)).toBe(10);
      expect(sheet.getValue(1, 0)).toBe(30);
    });

    it('does not record recalculated values as their own undo steps', async () => {
      // Undo must step back through actions, not through arithmetic.
      const store = await storeWithEngine();

      store.setCellInput(0, 0, '1');
      store.setCellInput(1, 0, '=A1+1');
      store.undo();
      store.undo();

      expect(store.commands.canUndo()).toBe(false);
      expect(store.activeSheet().cellCount).toBe(0);
    });
  });

  it('clears contents but keeps formatting', () => {
    const store = new WorkbookStore();
    store.setCellInput(0, 0, 'x');
    store.selection.selectCell({ row: 0, col: 0 });
    store.applyStyle({ bold: true }, 'Bold', 'home.font.bold');

    store.clearContents();

    expect(store.activeSheet().getValue(0, 0)).toBeNull();
    expect(store.styleAt(0, 0).bold).toBe(true);
  });

  it('formats every cell of a multi-cell selection', () => {
    const store = new WorkbookStore();
    store.selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 2, col: 1 } });

    store.applyStyle({ bold: true }, 'Bold', 'home.font.bold');

    expect(store.styleAt(2, 1).bold).toBe(true);
    // Interning: six cells that look alike must share one style object.
    expect(store.workbook.styles.size).toBe(2);
  });

  it('records which ribbon control made a change, for marking', () => {
    const store = new WorkbookStore();
    store.selection.selectCell({ row: 0, col: 0 });
    store.applyStyle({ bold: true }, 'Bold', 'home.font.bold');

    const last = store.commands.operationLog().at(-1);

    expect(last?.source).toBe('ribbon');
    expect(last?.control).toBe('home.font.bold');
  });

  describe('sheets', () => {
    it('adds, activates and removes', () => {
      const store = new WorkbookStore();

      store.addSheet();
      expect(store.workbook.sheetCount).toBe(2);
      expect(store.activeSheet().name).toBe('Sheet2');

      store.removeSheet(store.activeSheet().id);
      expect(store.workbook.sheetCount).toBe(1);
    });

    it('refuses to delete the last sheet', () => {
      const store = new WorkbookStore();
      store.removeSheet(store.activeSheet().id);

      expect(store.workbook.sheetCount).toBe(1);
    });

    it('refuses a name Excel would refuse', () => {
      const store = new WorkbookStore();

      expect(store.renameSheet(store.activeSheet().id, 'Budget/2026')).toBe(false);
      expect(store.renameSheet(store.activeSheet().id, 'Budget')).toBe(true);
    });
  });

  describe('clipboard', () => {
    it('pastes values and translates relative references', async () => {
      const store = await storeWithEngine();
      const sheet = store.activeSheet();

      store.setCellInput(0, 0, '10');
      store.setCellInput(0, 1, '=A1*2');

      store.selection.selectCell({ row: 0, col: 1 });
      store.copySelection();
      store.selection.selectCell({ row: 1, col: 1 });
      store.paste();

      // B2 = A2 * 2, and A2 is empty, so 0 — but the formula must have moved.
      expect(store.editText(1, 1)).toBe('=A2*2');
      expect(sheet.getValue(0, 1)).toBe(20);
    });

    it('carries formatting with the cell', () => {
      const store = new WorkbookStore();
      store.setCellInput(0, 0, 'x');
      store.selection.selectCell({ row: 0, col: 0 });
      store.applyStyle({ bold: true }, 'Bold', 'home.font.bold');

      store.copySelection();
      store.selection.selectCell({ row: 4, col: 4 });
      store.paste();

      expect(store.styleAt(4, 4).bold).toBe(true);
    });

    it('empties the source on cut, and keeps the formula as written', () => {
      const store = new WorkbookStore();
      store.setCellInput(0, 0, '=B1+1');
      store.selection.selectCell({ row: 0, col: 0 });

      store.cutSelection();
      store.selection.selectCell({ row: 3, col: 0 });
      store.paste();

      expect(store.activeSheet().getCell(0, 0)).toBeUndefined();
      // A cut moves a formula; it does not re-point it. Excel agrees.
      expect(store.editText(3, 0)).toBe('=B1+1');
    });

    it('reports that there is nothing to paste', () => {
      expect(new WorkbookStore().canPaste()).toBe(false);
    });
  });

  it('notifies subscribers once per change', () => {
    const store = new WorkbookStore();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });

    store.setCellInput(0, 0, '1');
    const after = store.getVersion();

    expect(calls).toBe(1);
    expect(after).toBe(1);
  });
});

describe('load', () => {
  it('replaces the workbook and starts the history over', async () => {
    // Undo on one question must never reach another question's edits. The
    // command bus goes with the workbook for exactly that reason.
    const store = await storeWithEngine();
    store.setCellInput(0, 0, 'first question');
    expect(store.commands.canUndo()).toBe(true);

    store.load(workbookFromSnapshot(blankSnapshot()));

    expect(store.commands.canUndo()).toBe(false);
    expect(store.activeSheet().cellCount).toBe(0);
    expect(store.selection.getActive()).toEqual({ row: 0, col: 0 });
  });

  it('keeps calculating against the workbook that is now loaded', async () => {
    // The engine is created once per sitting but resolves references through
    // the store, so a swapped workbook must not leave it reading the old one.
    const store = await storeWithEngine();
    store.setCellInput(0, 0, '1');

    store.load(workbookFromSnapshot(blankSnapshot()));
    store.setCellInput(0, 0, '10');
    store.setCellInput(1, 0, '=A1*2');

    expect(store.activeSheet().getValue(1, 0)).toBe(20);
  });
});
