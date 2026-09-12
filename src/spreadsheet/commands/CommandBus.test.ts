import { describe, expect, it } from 'vitest';
import { CommandBus, MAX_UNDO_DEPTH } from './CommandBus';
import { Workbook } from '../model/Workbook';
import { DEFAULT_STYLE_ID } from '../model/styles';
import type { Cell } from '../model/Cell';

/**
 * Undo has to be correct by construction, not by discipline.
 *
 * Every mutation goes through a mutator that records its own before-state, so
 * the class of bug these tests exist to catch is "a change that undo does not
 * know how to reverse" — which in a spreadsheet means silent, unrecoverable
 * data loss the moment someone presses Ctrl+Z.
 */

const text = (value: string): Cell => ({ value, styleId: DEFAULT_STYLE_ID });

function setup() {
  const workbook = Workbook.blank();
  const bus = new CommandBus(workbook);
  const sheetId = workbook.activeSheetId;
  return { workbook, bus, sheetId, sheet: () => workbook.sheetById(sheetId)! };
}

describe('transactions', () => {
  it('records what a command did and reverses it exactly', () => {
    const { bus, sheetId, sheet } = setup();

    bus.run({ label: 'Type', source: 'grid' }, (m) => m.setCell(sheetId, 0, 0, text('hello')));
    expect(sheet().getValue(0, 0)).toBe('hello');

    bus.undo();
    expect(sheet().getValue(0, 0)).toBeNull();

    bus.redo();
    expect(sheet().getValue(0, 0)).toBe('hello');
  });

  it('leaves no transaction when a command changes nothing', () => {
    // Otherwise Undo appears to do nothing, which reads as a broken editor.
    const { bus, sheetId } = setup();

    const transaction = bus.run({ label: 'Bold', source: 'ribbon' }, (m) =>
      m.setStyle(sheetId, 0, 0, DEFAULT_STYLE_ID),
    );

    expect(transaction).toBeNull();
    expect(bus.canUndo()).toBe(false);
  });

  it('undoes a multi-cell command as one unit', () => {
    // Bolding a selection is one Ctrl+Z, not one per cell.
    const { bus, sheetId, sheet } = setup();

    bus.run({ label: 'Fill', source: 'ribbon' }, (m) => {
      for (let row = 0; row < 5; row += 1) m.setCell(sheetId, row, 0, text(`r${row}`));
    });

    expect(bus.undo()).not.toBeNull();
    for (let row = 0; row < 5; row += 1) expect(sheet().getValue(row, 0)).toBeNull();
    expect(bus.canUndo()).toBe(false);
  });

  it('reverses operations within a transaction in reverse order', () => {
    // Two writes to one cell: undoing forwards would leave the first value.
    const { bus, sheetId, sheet } = setup();

    bus.run({ label: 'Twice', source: 'grid' }, (m) => {
      m.setCell(sheetId, 0, 0, text('first'));
      m.setCell(sheetId, 0, 0, text('second'));
    });

    bus.undo();
    expect(sheet().getValue(0, 0)).toBeNull();
  });

  it('carries the control that ran it, so the exam rule is gradeable', () => {
    // Without this a grader can only see that a range ended up bold, never
    // that the candidate used the ribbon to do it.
    const { bus, sheetId } = setup();

    const transaction = bus.run(
      { label: 'Bold', source: 'ribbon', control: 'home.font.bold' },
      (m) => m.setCell(sheetId, 0, 0, { value: 'x', styleId: 3 }),
    );

    expect(transaction).toMatchObject({ source: 'ribbon', control: 'home.font.bold', label: 'Bold' });
  });

  it('reports the label Undo would reverse', () => {
    const { bus, sheetId } = setup();
    bus.run({ label: 'Merge & Center', source: 'ribbon' }, (m) => m.setCell(sheetId, 0, 0, text('a')));

    expect(bus.undoLabel()).toBe('Merge & Center');
    bus.undo();
    expect(bus.undoLabel()).toBeNull();
    expect(bus.redoLabel()).toBe('Merge & Center');
  });

  it('discards the redo branch once a new edit lands', () => {
    const { bus, sheetId, sheet } = setup();
    bus.run({ label: 'A', source: 'grid' }, (m) => m.setCell(sheetId, 0, 0, text('a')));
    bus.undo();

    bus.run({ label: 'B', source: 'grid' }, (m) => m.setCell(sheetId, 1, 0, text('b')));

    expect(bus.canRedo()).toBe(false);
    expect(sheet().getValue(0, 0)).toBeNull();
    expect(sheet().getValue(1, 0)).toBe('b');
  });

  it('caps the undo stack without corrupting what remains', () => {
    // Each operation carries its own before-state, so dropping the oldest
    // transaction cannot invalidate the ones still on the stack.
    const { bus, sheetId, sheet } = setup();

    for (let i = 0; i < MAX_UNDO_DEPTH + 10; i += 1) {
      bus.run({ label: `Edit ${i}`, source: 'grid' }, (m) => m.setCell(sheetId, i, 0, text(`v${i}`)));
    }

    let undone = 0;
    while (bus.undo()) undone += 1;

    expect(undone).toBe(MAX_UNDO_DEPTH);
    // The oldest ten fell off the stack, so their values legitimately remain.
    expect(sheet().getValue(0, 0)).toBe('v0');
    expect(sheet().getValue(MAX_UNDO_DEPTH + 9, 0)).toBeNull();
  });
});

describe('the operation log', () => {
  it('keeps undone transactions, unlike the undo stack', () => {
    // A grader wants to know the candidate ran Merge & Center even if they
    // thought better of it.
    const { bus, sheetId } = setup();

    bus.run({ label: 'Merge', source: 'ribbon', control: 'home.alignment.merge' }, (m) =>
      m.setCell(sheetId, 0, 0, text('a')),
    );
    bus.undo();

    expect(bus.operationLog()).toHaveLength(1);
    expect(bus.operationLog()[0]).toMatchObject({ control: 'home.alignment.merge' });
  });

  it('is plain JSON — no closures, no live references into the workbook', () => {
    // A future grading engine reads these as data. A transaction holding a
    // function or a reference to a live cell would be unreadable to it.
    const { bus, sheetId } = setup();
    bus.run({ label: 'Type', source: 'grid' }, (m) => m.setCell(sheetId, 2, 3, text('x')));

    const round = JSON.parse(JSON.stringify(bus.operationLog())) as unknown;
    expect(round).toEqual(bus.operationLog());
  });

  it('records the before-state as a copy, not a reference', () => {
    // The sheet may hand back the object it stores; undo needs the value as it
    // was, not a window onto what it became.
    const { bus, sheetId, sheet } = setup();
    bus.run({ label: 'First', source: 'grid' }, (m) => m.setCell(sheetId, 0, 0, text('one')));
    bus.run({ label: 'Second', source: 'grid' }, (m) => m.setCell(sheetId, 0, 0, text('two')));

    bus.undo();
    expect(sheet().getValue(0, 0)).toBe('one');
  });
});

describe('sheet operations', () => {
  it('adds and removes a sheet reversibly', () => {
    const { workbook, bus } = setup();

    let added = '';
    bus.run({ label: 'Insert Sheet', source: 'sheetTabs' }, (m) => {
      added = m.addSheet('Sheet2');
    });
    expect(workbook.sheetCount).toBe(2);

    bus.undo();
    expect(workbook.sheetCount).toBe(1);
    expect(workbook.sheetById(added)).toBeUndefined();
  });

  it('restores everything a deleted sheet held', () => {
    // Deleting a sheet is the largest thing one operation can do, and the one
    // where "undo mostly works" would be least forgivable.
    const { workbook, bus } = setup();

    let second = '';
    bus.run({ label: 'Insert Sheet', source: 'sheetTabs' }, (m) => {
      second = m.addSheet('Data');
    });
    bus.run({ label: 'Fill', source: 'grid' }, (m) => {
      m.setCell(second, 3, 4, text('kept'));
      m.setRowProps(second, 3, { height: 44 });
      m.setColumnProps(second, 4, { width: 120 });
      m.mergeCells(second, { start: { row: 0, col: 0 }, end: { row: 0, col: 2 } });
      m.setFrozen(second, 1, 1);
    });

    bus.run({ label: 'Delete Sheet', source: 'sheetTabs' }, (m) => m.removeSheet(second));
    expect(workbook.sheetById(second)).toBeUndefined();

    bus.undo();

    const restored = workbook.sheetById(second)!;
    expect(restored.name).toBe('Data');
    expect(restored.getValue(3, 4)).toBe('kept');
    expect(restored.rowHeight(3)).toBe(44);
    expect(restored.columnWidth(4)).toBe(120);
    expect(restored.mergeCovering(0, 2)?.start).toEqual({ row: 0, col: 0 });
    expect(restored.frozen).toEqual({ rows: 1, columns: 1 });
  });

  it('refuses to remove the last sheet, and records nothing when it does', () => {
    const { workbook, bus, sheetId } = setup();

    const transaction = bus.run({ label: 'Delete Sheet', source: 'sheetTabs' }, (m) =>
      m.removeSheet(sheetId),
    );

    expect(transaction).toBeNull();
    expect(workbook.sheetCount).toBe(1);
  });

  it('renames reversibly and refuses a name that clashes', () => {
    const { workbook, bus, sheetId } = setup();
    bus.run({ label: 'Insert Sheet', source: 'sheetTabs' }, (m) => m.addSheet('Data'));

    bus.run({ label: 'Rename', source: 'sheetTabs' }, (m) => m.renameSheet(sheetId, 'Summary'));
    expect(workbook.sheetById(sheetId)?.name).toBe('Summary');

    // Case-insensitively taken by the other sheet.
    const clash = bus.run({ label: 'Rename', source: 'sheetTabs' }, (m) =>
      m.renameSheet(sheetId, 'DATA'),
    );
    expect(clash).toBeNull();
    expect(workbook.sheetById(sheetId)?.name).toBe('Summary');

    bus.undo();
    expect(workbook.sheetById(sheetId)?.name).toBe('Sheet1');
  });

  it('reorders reversibly', () => {
    const { workbook, bus, sheetId } = setup();
    bus.run({ label: 'Insert Sheet', source: 'sheetTabs' }, (m) => m.addSheet('Second'));

    bus.run({ label: 'Move Sheet', source: 'sheetTabs' }, (m) => m.moveSheet(sheetId, 1));
    expect(workbook.allSheets().map((s) => s.name)).toEqual(['Second', 'Sheet1']);

    bus.undo();
    expect(workbook.allSheets().map((s) => s.name)).toEqual(['Sheet1', 'Second']);
  });
});

describe('merging', () => {
  it('clears the covered cells and puts them back on undo', () => {
    // Excel discards everything but the top-left and warns first. Recording
    // what was discarded is what makes that warning undoable rather than final.
    const { bus, sheetId, sheet } = setup();
    bus.run({ label: 'Fill', source: 'grid' }, (m) => {
      m.setCell(sheetId, 0, 0, text('keep'));
      m.setCell(sheetId, 0, 1, text('lose'));
    });

    bus.run({ label: 'Merge & Center', source: 'ribbon' }, (m) =>
      m.mergeCells(sheetId, { start: { row: 0, col: 0 }, end: { row: 0, col: 1 } }),
    );

    expect(sheet().getValue(0, 0)).toBe('keep');
    expect(sheet().getValue(0, 1)).toBeNull();

    bus.undo();

    expect(sheet().getValue(0, 1)).toBe('lose');
    expect(sheet().mergeCovering(0, 1)).toBeUndefined();
  });

  it('records nothing when the sheet refuses the merge', () => {
    const { bus, sheetId } = setup();
    bus.run({ label: 'Merge', source: 'ribbon' }, (m) =>
      m.mergeCells(sheetId, { start: { row: 0, col: 0 }, end: { row: 2, col: 2 } }),
    );

    const overlapping = bus.run({ label: 'Merge', source: 'ribbon' }, (m) =>
      m.mergeCells(sheetId, { start: { row: 1, col: 1 }, end: { row: 3, col: 3 } }),
    );

    expect(overlapping).toBeNull();
  });
});

describe('subscribers', () => {
  it('notifies on commit, undo and redo', () => {
    // The grid repaints from this; missing the undo notification would leave
    // the screen showing a value the workbook no longer holds.
    const { bus, sheetId } = setup();
    const seen: string[] = [];
    bus.subscribe((transaction) => seen.push(transaction.label));

    bus.run({ label: 'Type', source: 'grid' }, (m) => m.setCell(sheetId, 0, 0, text('a')));
    bus.undo();
    bus.redo();

    expect(seen).toEqual(['Type', 'Type', 'Type']);
  });

  it('stops notifying once unsubscribed', () => {
    const { bus, sheetId } = setup();
    let count = 0;
    const stop = bus.subscribe(() => (count += 1));

    bus.run({ label: 'A', source: 'grid' }, (m) => m.setCell(sheetId, 0, 0, text('a')));
    stop();
    bus.run({ label: 'B', source: 'grid' }, (m) => m.setCell(sheetId, 1, 0, text('b')));

    expect(count).toBe(1);
  });
});
