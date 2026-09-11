import { describe, expect, it } from 'vitest';
import {
  MAX_SNAPSHOT_CELLS,
  SnapshotTooLargeError,
  blankSnapshot,
  snapshotWorkbook,
  snapshotsEqual,
  workbookFromSnapshot,
} from './snapshot';
import { Workbook } from './Workbook';
import { Worksheet } from './Worksheet';

/**
 * A snapshot is what a candidate's answer *is* once it leaves the browser. If
 * the round trip loses anything, the server marks something the candidate never
 * submitted — the worst failure this system has, because it is invisible from
 * both ends.
 */

function sheetWithData(): Workbook {
  const workbook = new Workbook([new Worksheet('sheet1', 'Sales')]);
  const sheet = workbook.activeSheet()!;

  sheet.setCell(0, 0, { value: 'Item', styleId: workbook.styles.intern({ bold: true }) });
  sheet.setCell(0, 1, { value: 'Amount', styleId: workbook.styles.intern({ bold: true }) });
  sheet.setCell(1, 0, { value: 'Rice', styleId: 0 });
  sheet.setCell(1, 1, { value: 120, styleId: workbook.styles.intern({ numberFormat: '#,##0.00' }) });
  sheet.setCell(2, 1, { value: 120, formula: '=SUM(B2:B2)', styleId: 0 });

  sheet.setColumnProps(0, { width: 140 });
  sheet.setRowProps(0, { height: 28 });
  sheet.mergeCells({ start: { row: 4, col: 0 }, end: { row: 4, col: 2 } });
  sheet.freeze(1, 1);

  return workbook;
}

describe('snapshotWorkbook / workbookFromSnapshot', () => {
  it('round-trips values, formulas, styles, widths, merges and frozen panes', () => {
    const before = snapshotWorkbook(sheetWithData());
    const after = snapshotWorkbook(workbookFromSnapshot(before));

    expect(after).toEqual(before);
  });

  it('keeps a formula as source, with its computed value beside it', () => {
    const restored = workbookFromSnapshot(snapshotWorkbook(sheetWithData()));
    const cell = restored.activeSheet()!.getCell(2, 1);

    expect(cell?.formula).toBe('=SUM(B2:B2)');
    expect(cell?.value).toBe(120);
  });

  it('carries styles by value, so ids from another registry cannot leak in', () => {
    // A styleId is an index into one registry. Sending ids would decode into
    // whatever styles happened to sit in those slots on the far side.
    const snapshot = snapshotWorkbook(sheetWithData());
    const header = snapshot.sheets[0]!.cells.find((cell) => cell.row === 0 && cell.col === 0);

    expect(header?.style).toEqual({ bold: true });
    expect(JSON.stringify(snapshot)).not.toContain('styleId');
  });

  it('re-interns on the way back, so shared styles are still shared', () => {
    const restored = workbookFromSnapshot(snapshotWorkbook(sheetWithData()));
    const sheet = restored.activeSheet()!;

    // Both headers are bold; interning must give them one style, not two.
    expect(sheet.getCell(0, 0)?.styleId).toBe(sheet.getCell(0, 1)?.styleId);
    // Default, bold, and the number format — three, not five.
    expect(restored.styles.size).toBe(3);
  });

  it('omits the default style rather than writing {} for every blank-formatted cell', () => {
    const snapshot = snapshotWorkbook(sheetWithData());
    const plain = snapshot.sheets[0]!.cells.find((cell) => cell.row === 1 && cell.col === 0);

    expect(plain).not.toHaveProperty('style');
  });

  it('orders cells so the same workbook always produces the same bytes', () => {
    // Map iteration follows the order the candidate typed in. Two candidates
    // with identical sheets must still produce identical snapshots.
    const forwards = new Workbook([new Worksheet('sheet1', 'S')]);
    forwards.activeSheet()!.setCell(0, 0, { value: 1, styleId: 0 });
    forwards.activeSheet()!.setCell(5, 3, { value: 2, styleId: 0 });

    const backwards = new Workbook([new Worksheet('sheet1', 'S')]);
    backwards.activeSheet()!.setCell(5, 3, { value: 2, styleId: 0 });
    backwards.activeSheet()!.setCell(0, 0, { value: 1, styleId: 0 });

    expect(JSON.stringify(snapshotWorkbook(forwards))).toBe(JSON.stringify(snapshotWorkbook(backwards)));
  });

  it('refuses a workbook too large to submit', () => {
    const workbook = new Workbook([new Worksheet('sheet1', 'S')]);
    const sheet = workbook.activeSheet()!;
    for (let row = 0; row <= MAX_SNAPSHOT_CELLS; row += 1) {
      sheet.setCell(row, 0, { value: row, styleId: 0 });
    }

    expect(() => snapshotWorkbook(workbook)).toThrow(SnapshotTooLargeError);
  });

  it('always decodes to at least one sheet', () => {
    // A workbook with no sheets has nowhere to put a cell, and every consumer
    // would need a branch for it.
    expect(workbookFromSnapshot({ sheets: [] }).sheetCount).toBe(1);
  });
});

describe('snapshotsEqual', () => {
  it('is true for a workbook that has not been touched', () => {
    const snapshot = snapshotWorkbook(sheetWithData());

    expect(snapshotsEqual(snapshot, snapshotWorkbook(workbookFromSnapshot(snapshot)))).toBe(true);
  });

  it('is false once a single cell changes', () => {
    // This is what decides whether a question counts as attempted.
    const workbook = workbookFromSnapshot(blankSnapshot());
    const before = snapshotWorkbook(workbook);

    workbook.activeSheet()!.setCell(0, 0, { value: 'x', styleId: 0 });

    expect(snapshotsEqual(before, snapshotWorkbook(workbook))).toBe(false);
  });

  it('is false when only the formatting changes', () => {
    const workbook = workbookFromSnapshot(blankSnapshot());
    workbook.activeSheet()!.setCell(0, 0, { value: 'x', styleId: 0 });
    const before = snapshotWorkbook(workbook);

    workbook.activeSheet()!.setCell(0, 0, { value: 'x', styleId: workbook.styles.intern({ bold: true }) });

    expect(snapshotsEqual(before, snapshotWorkbook(workbook))).toBe(false);
  });
});
