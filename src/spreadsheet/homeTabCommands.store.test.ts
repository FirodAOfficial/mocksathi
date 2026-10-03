import { describe, expect, it } from 'vitest';
import { bordersAt, stepFontSize, withDecimals } from '@/components/spreadsheet/ribbon/SheetHomeTab';
import { formatCellValue } from './model/format';
import { WorkbookStore } from './WorkbookStore';

/**
 * The Home tab's commands, through the store: what each one leaves in the
 * cells, and that each is a single undoable step.
 */

const options = { matchCase: false, entireCell: false };

async function storeWithEngine(): Promise<WorkbookStore> {
  const store = new WorkbookStore();
  await store.ensureEngine();
  return store;
}

function select(store: WorkbookStore, top: number, left: number, bottom = top, right = left): void {
  store.selection.selectRange({ start: { row: top, col: left }, end: { row: bottom, col: right } });
}

describe('Paste options', () => {
  it('pastes values, formulas and formatting separately', async () => {
    const store = await storeWithEngine();
    const sheet = store.activeSheet();
    store.setCellInput(0, 0, '4');
    store.setCellInput(1, 0, '=A1*2');
    select(store, 1, 0);
    store.applyStyle({ bold: true }, 'Bold');
    store.copySelection();

    select(store, 1, 2);
    store.paste('values');
    expect(sheet.getCell(1, 2)).toMatchObject({ value: 8 });
    expect(sheet.getCell(1, 2)?.formula).toBeUndefined();
    expect(store.styleAt(1, 2).bold).toBeUndefined();

    select(store, 1, 3);
    store.paste('formulas');
    expect(sheet.getCell(1, 3)?.formula).toBe('=D1*2');
    expect(store.styleAt(1, 3).bold).toBeUndefined();

    select(store, 1, 4);
    store.paste('formats');
    expect(store.styleAt(1, 4).bold).toBe(true);
    expect(sheet.getCell(1, 4)?.value).toBeNull();
  });

  it('only pastes a cut whole', () => {
    const store = new WorkbookStore();
    store.setCellInput(0, 0, 'x');
    store.cutSelection();
    select(store, 3, 3);

    expect(store.paste('values')).toBe(false);
    expect(store.paste('all')).toBe(true);
    expect(store.activeSheet().getValue(3, 3)).toBe('x');
  });
});

describe('Format Painter', () => {
  it('paints the picked-up formatting at the brush’s shape, then puts it down', () => {
    const store = new WorkbookStore();
    select(store, 0, 0);
    store.applyStyle({ fillColor: '#ffff00' }, 'Fill');
    store.setCellInput(4, 4, 'keep');

    select(store, 0, 0, 1, 0);
    store.pickUpFormat();
    expect(store.hasFormatBrush()).toBe(true);

    select(store, 4, 4);
    store.paintFormat();

    expect(store.styleAt(4, 4).fillColor).toBe('#ffff00');
    expect(store.styleAt(5, 4).fillColor).toBeUndefined();
    expect(store.activeSheet().getValue(4, 4)).toBe('keep');
    expect(store.hasFormatBrush()).toBe(false);
    expect(store.commands.undoLabel()).toBe('Format Painter');
  });
});

describe('Clear', () => {
  it('clears formats but not values, or both', () => {
    const store = new WorkbookStore();
    store.setCellInput(0, 0, '5');
    select(store, 0, 0, 0, 1);
    store.applyStyle({ italic: true }, 'Italic');

    store.clearFormats();
    expect(store.styleAt(0, 0).italic).toBeUndefined();
    expect(store.activeSheet().getValue(0, 0)).toBe(5);
    // B1 held only formatting, so it is gone altogether.
    expect(store.activeSheet().getCell(0, 1)).toBeUndefined();

    store.clearAll();
    expect(store.activeSheet().getCell(0, 0)).toBeUndefined();
  });
});

describe('Fill', () => {
  it('fills down with formulas moved, as one undo', async () => {
    const store = await storeWithEngine();
    const sheet = store.activeSheet();
    store.setCellInput(0, 0, '1');
    store.setCellInput(1, 0, '2');
    store.setCellInput(2, 0, '3');
    store.setCellInput(0, 1, '=A1*10');

    select(store, 0, 1, 2, 1);
    expect(store.fill('down')).toBe(true);

    expect(sheet.getCell(2, 1)?.formula).toBe('=A3*10');
    expect(sheet.getValue(2, 1)).toBe(30);

    store.undo();
    expect(sheet.getCell(2, 1)).toBeUndefined();
  });

  it('fills a single cell from its neighbour, and refuses at the edge', () => {
    const store = new WorkbookStore();
    store.setCellInput(0, 0, 'top');

    select(store, 1, 0);
    expect(store.fill('down')).toBe(true);
    expect(store.activeSheet().getValue(1, 0)).toBe('top');

    select(store, 0, 0);
    expect(store.fill('down')).toBe(false);
  });

  it('fills right, up and left from the matching edge', () => {
    const store = new WorkbookStore();
    store.setCellInput(0, 0, 'L');
    store.setCellInput(5, 0, 'B');

    select(store, 0, 0, 0, 2);
    store.fill('right');
    expect(store.activeSheet().getValue(0, 2)).toBe('L');

    select(store, 3, 0, 5, 0);
    store.fill('up');
    expect(store.activeSheet().getValue(3, 0)).toBe('B');

    select(store, 0, 0, 0, 2);
    store.setCellInput(0, 2, 'R');
    store.fill('left');
    expect(store.activeSheet().getValue(0, 0)).toBe('R');
  });
});

describe('Format: size and visibility', () => {
  it('sets, resets and hides rows and columns', () => {
    const store = new WorkbookStore();
    const sheet = store.activeSheet();

    store.resize('row', [1, 2], 40, 'Row Height', 'home.cells.format.rowHeight');
    expect(sheet.rowHeight(2)).toBe(40);

    store.resize('row', [1, 2], undefined, 'AutoFit Row Height', 'home.cells.format.autoFitRows');
    expect(sheet.rows.get(2)).toBeUndefined();

    expect(store.setHidden('column', [3], true)).toBe(true);
    expect(sheet.columnWidth(3)).toBe(0);
    expect(store.setHidden('column', [3], true)).toBe(false);

    store.setHidden('column', [2, 3, 4], false);
    expect(sheet.columns.get(3)).toBeUndefined();
  });
});

describe('Find & Replace', () => {
  it('finds in reading order, wrapping round', () => {
    const store = new WorkbookStore();
    store.setCellInput(2, 0, 'Apple pie');
    store.setCellInput(0, 3, 'apple');
    store.setCellInput(5, 5, 'Pear');

    expect(store.findAll('APPLE', options)).toEqual([
      { row: 0, col: 3 },
      { row: 2, col: 0 },
    ]);
    expect(store.findAll('APPLE', { ...options, matchCase: true })).toEqual([]);
    expect(store.findAll('apple', { ...options, entireCell: true })).toEqual([{ row: 0, col: 3 }]);

    select(store, 1, 0);
    expect(store.findNext('apple', options)).toEqual({ row: 2, col: 0 });
    expect(store.findNext('apple', options)).toEqual({ row: 0, col: 3 });
  });

  it('replaces every match as one step, re-reading the new text', () => {
    const store = new WorkbookStore();
    store.setCellInput(0, 0, 'Q1 sales');
    store.setCellInput(1, 0, 'Q1');
    store.setCellInput(2, 0, '$5');

    expect(store.replaceAll('q1', '2024', options)).toBe(2);
    expect(store.activeSheet().getValue(0, 0)).toBe('2024 sales');
    // A cell that became a number is stored as one.
    expect(store.activeSheet().getValue(1, 0)).toBe(2024);

    // `$` in the replacement is text, not a pattern reference.
    store.replaceAll('$5', '$&', options);
    expect(store.activeSheet().getValue(2, 0)).toBe('$&');

    store.undo();
    store.undo();
    expect(store.activeSheet().getValue(0, 0)).toBe('Q1 sales');
  });
});

describe('Merge Cells', () => {
  it('merges without centring', () => {
    const store = new WorkbookStore();
    select(store, 0, 0, 1, 1);

    expect(store.mergeCellsOnly()).toBe(true);
    expect(store.activeSheet().mergeCovering(1, 1)).toBeDefined();
    expect(store.styleAt(0, 0).horizontalAlignment).toBeUndefined();
  });
});

describe('Home tab helpers', () => {
  it('steps the font size along Excel’s list', () => {
    expect(stepFontSize(11, 1)).toBe(12);
    expect(stepFontSize(13, 1)).toBe(14);
    expect(stepFontSize(72, 1)).toBe(80);
    expect(stepFontSize(11, -1)).toBe(10);
    expect(stepFontSize(8, -1)).toBe(7);
    expect(stepFontSize(1, -1)).toBe(1);
  });

  it('keeps the currency when changing decimals', () => {
    expect(withDecimals('$#,##0.00', -1)).toBe('$#,##0.0');
    expect(withDecimals('€#,##0', 1)).toBe('€#,##0.0');
    expect(formatCellValue(1234.5, '£#,##0.00')).toBe('£1,234.50');
  });

  it('draws the edge presets on the selection’s edges only', () => {
    const range = { start: { row: 0, col: 0 }, end: { row: 2, col: 1 } };

    expect(bordersAt('bottomDouble', { row: 2, col: 0 }, range)).toEqual({
      bottom: { style: 'double', color: '#000000' },
    });
    expect(bordersAt('bottomDouble', { row: 1, col: 0 }, range)).toBeUndefined();
    expect(bordersAt('topThickBottom', { row: 0, col: 1 }, range)).toEqual({
      top: { style: 'thin', color: '#000000' },
    });
    expect(bordersAt('thickOutline', { row: 1, col: 1 }, range)).toEqual({
      right: { style: 'thick', color: '#000000' },
    });
  });
});

describe('Format Cells', () => {
  it('applies a dialog’s changes, borders and a merge as one step', async () => {
    const { borderedCell } = await import('@/components/spreadsheet/FormatCellsDialog');
    const store = new WorkbookStore();
    const range = { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } };
    const thin = { style: 'thin' as const, color: '#000000' };
    store.selection.selectRange(range);

    const merged = store.formatCells(
      (address) => ({
        bold: true,
        borders: borderedCell(store.styleAt(address.row, address.col).borders, { top: thin, insideV: thin }, address, range),
      }),
      true,
    );

    expect(merged).toBe(true);
    expect(store.activeSheet().mergeCovering(1, 1)).toBeDefined();
    expect(store.styleAt(1, 1).bold).toBe(true);
    // Top edge on the top row only; the inside vertical between the columns.
    expect(store.styleAt(0, 0).borders).toEqual({ top: thin, right: thin });
    expect(store.styleAt(1, 1).borders).toEqual({ left: thin });

    store.undo();
    expect(store.activeSheet().mergeCovering(1, 1)).toBeUndefined();
    expect(store.styleAt(1, 1).bold).toBeUndefined();
  });

  it('removes only the edges the dialog cleared', async () => {
    const { borderedCell } = await import('@/components/spreadsheet/FormatCellsDialog');
    const thick = { style: 'thick' as const, color: '#ff0000' };
    const cell = { row: 0, col: 0 };
    const range = { start: cell, end: cell };

    expect(borderedCell({ top: thick, left: thick }, { top: null }, cell, range)).toEqual({ left: thick });
    expect(borderedCell({ top: thick }, { top: null }, cell, range)).toBeUndefined();
    expect(borderedCell({ top: thick }, {}, cell, range)).toEqual({ top: thick });
  });
});

describe('AutoFit', () => {
  it('fits a column to its longest value, and a row to its tallest font', async () => {
    const { autoFitColumnWidth, autoFitRowHeight } = await import('@/components/spreadsheet/grid/autoFit');
    const store = new WorkbookStore();
    store.setCellInput(0, 0, 'A much longer heading than the column');
    store.setCellInput(1, 0, 'x');

    const width = autoFitColumnWidth(store, 0);
    expect(width).toBeGreaterThan(200);
    // An empty column goes back to the standard width.
    expect(autoFitColumnWidth(store, 5)).toBe(64);

    expect(autoFitRowHeight(store, 0)).toBeUndefined();
    select(store, 0, 0);
    store.applyStyle({ fontSize: 24 }, 'Font Size');
    expect(autoFitRowHeight(store, 0)).toBeGreaterThan(36);

    store.resize('column', [0], (col) => autoFitColumnWidth(store, col), 'AutoFit Column Width', 'grid.header.autoFit', 'grid');
    expect(store.activeSheet().columnWidth(0)).toBeGreaterThan(width);
  });
});
