import { describe, expect, it } from 'vitest';
import { applySheetEdit } from './model/structuralEdit';
import { currentRegion, passes } from './model/autoFilter';
import { snapshotSheet, snapshotWorkbook, workbookFromSnapshot } from './model/snapshot';
import { WorkbookStore } from './WorkbookStore';

/*  B        C
 * 2 Name    Marks
 * 3 Rahul   45
 * 4 Priya   82
 * 5 Aman    67
 * 6 rahul   90
 */
function table(): WorkbookStore {
  const store = new WorkbookStore();
  const rows = [['Name', 'Marks'], ['Rahul', '45'], ['Priya', '82'], ['Aman', '67'], ['rahul', '90']];
  rows.forEach((cells, row) => cells.forEach((input, col) => store.setCellInput(row + 1, col + 1, input)));
  store.selection.selectCell({ row: 3, col: 2 });
  return store;
}

const hidden = (store: WorkbookStore): number[] =>
  [...store.activeSheet().rows].filter(([, props]) => props.hidden).map(([row]) => row).sort((a, b) => a - b);

describe('AutoFilter', () => {
  it('finds the table around the cursor', () => {
    const store = table();
    expect(store.toggleAutoFilter()).toBeNull();
    expect(store.activeSheet().autoFilter?.range).toEqual({ start: { row: 1, col: 1 }, end: { row: 5, col: 2 } });
  });

  it('refuses an empty sheet', () => {
    expect(new WorkbookStore().toggleAutoFilter()).toMatch(/empty/);
  });

  it('hides the rows a checklist leaves unticked, and offers values Excel’s way', () => {
    const store = table();
    store.toggleAutoFilter();

    // Text compares without case; the checklist lists each once.
    expect(store.filterValues(1)).toEqual(['Aman', 'Priya', 'Rahul', 'rahul']);
    store.setColumnFilter(1, { kind: 'values', values: ['Priya', 'Aman'] });
    expect(hidden(store)).toEqual([2, 5]);
  });

  it('combines columns, and lists a column’s values under the other filters', () => {
    const store = table();
    store.toggleAutoFilter();
    store.setColumnFilter(2, { kind: 'number', op: 'greater', value: 50 });
    expect(hidden(store)).toEqual([2]);

    store.setColumnFilter(1, { kind: 'text', op: 'beginsWith', value: 'r' });
    expect(hidden(store)).toEqual([2, 3, 4]);
    // Rahul (45) is hidden by Marks, so Name's checklist does not offer it.
    expect(store.filterValues(1)).toEqual(['Aman', 'Priya', 'rahul']);
  });

  it('supports Top 10 and average filters', () => {
    const store = table();
    store.toggleAutoFilter();
    store.setColumnFilter(2, { kind: 'top', count: 2, bottom: false });
    expect(hidden(store)).toEqual([2, 4]);

    // The average of 45, 82, 67, 90 is 71.
    store.setColumnFilter(2, { kind: 'average', above: false });
    expect(hidden(store)).toEqual([3, 5]);
  });

  it('clears one column, all of them, or the whole filter', () => {
    const store = table();
    store.toggleAutoFilter();
    store.setColumnFilter(2, { kind: 'number', op: 'less', value: 70 });
    store.setColumnFilter(1, { kind: 'text', op: 'contains', value: 'a' });
    expect(hidden(store)).toEqual([3, 5]);

    store.setColumnFilter(2, null);
    expect(hidden(store)).toEqual([]);

    store.setColumnFilter(2, { kind: 'number', op: 'less', value: 70 });
    store.clearFilters();
    expect(hidden(store)).toEqual([]);
    expect(store.activeSheet().autoFilter?.columns).toEqual({});

    store.setColumnFilter(2, { kind: 'number', op: 'less', value: 70 });
    store.toggleAutoFilter();
    expect(store.activeSheet().autoFilter).toBeNull();
    expect(hidden(store)).toEqual([]);
  });

  it('undoes a filter with the rows it hid', () => {
    const store = table();
    store.toggleAutoFilter();
    store.setColumnFilter(2, { kind: 'number', op: 'between', value: 60, value2: 85 });
    expect(hidden(store)).toEqual([2, 5]);

    store.undo();
    expect(hidden(store)).toEqual([]);
    expect(store.activeSheet().autoFilter?.columns).toEqual({});
    store.undo();
    expect(store.activeSheet().autoFilter).toBeNull();
    store.redo();
    store.redo();
    expect(hidden(store)).toEqual([2, 5]);
  });

  it('sorts the rows under the headings and filters again', () => {
    const store = table();
    store.toggleAutoFilter();
    store.setColumnFilter(2, { kind: 'number', op: 'greater', value: 60 });

    expect(store.sortFilterColumn(2, 'desc')).toBeNull();
    const sheet = store.activeSheet();
    expect([2, 3, 4, 5].map((row) => sheet.getValue(row, 1))).toEqual(['rahul', 'Priya', 'Aman', 'Rahul']);
    expect(sheet.getValue(1, 1)).toBe('Name');
    // Rahul's 45 is now last, and still the one hidden.
    expect(hidden(store)).toEqual([5]);
  });

  it('grows over rows typed under the table when reapplied', () => {
    const store = table();
    store.toggleAutoFilter();
    store.setColumnFilter(2, { kind: 'number', op: 'greater', value: 60 });
    store.setCellInput(6, 1, 'Zoya');
    store.setCellInput(6, 2, '12');

    store.reapplyFilter();
    expect(store.activeSheet().autoFilter?.range.end.row).toBe(6);
    expect(hidden(store)).toEqual([2, 6]);
  });

  it('survives a snapshot, and leaves one without a filter as it was', () => {
    const store = table();
    const before = JSON.stringify(snapshotWorkbook(store.workbook));
    expect(before).not.toContain('autoFilter');

    store.toggleAutoFilter();
    store.setColumnFilter(1, { kind: 'values', values: ['Aman'] });
    const restored = workbookFromSnapshot(snapshotWorkbook(store.workbook));
    expect(restored.activeSheet()?.autoFilter?.columns[1]).toEqual({ kind: 'values', values: ['Aman'] });
  });

  it('moves with its table when rows and columns are inserted, and goes with a deleted header', () => {
    const store = table();
    store.toggleAutoFilter();
    store.setColumnFilter(2, { kind: 'number', op: 'greater', value: 60 });
    const snapshot = snapshotSheet(store.activeSheet(), store.workbook);

    const shifted = applySheetEdit(snapshot, { axis: 'column', at: 0, delta: 1 });
    expect(shifted.autoFilter?.range.start).toEqual({ row: 1, col: 2 });
    expect(Object.keys(shifted.autoFilter?.columns ?? {})).toEqual(['3']);

    const headerGone = applySheetEdit(snapshot, { axis: 'row', at: 1, delta: -1 });
    expect(headerGone.autoFilter).toBeUndefined();
  });
});

describe('autoFilter model', () => {
  it('compares numbers only against numbers', () => {
    expect(passes({ kind: 'number', op: 'greater', value: 5 }, { text: 'abc', value: 'abc' })).toBe(false);
    expect(passes({ kind: 'number', op: 'notEquals', value: 5 }, { text: 'abc', value: 'abc' })).toBe(true);
    expect(passes({ kind: 'text', op: 'endsWith', value: 'AN' }, { text: 'Aman', value: 'Aman' })).toBe(true);
  });

  it('grows a region over the filled block, diagonals included', () => {
    const filled = new Set(['2:2', '3:3', '4:3']);
    const region = currentRegion({ start: { row: 2, col: 2 }, end: { row: 2, col: 2 } }, (row, col) =>
      filled.has(`${row}:${col}`),
    );
    expect(region).toEqual({ start: { row: 2, col: 2 }, end: { row: 4, col: 3 } });
  });
});
