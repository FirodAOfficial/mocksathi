import { describe, expect, it } from 'vitest';
import { WorkbookStore } from '../WorkbookStore';

/**
 * The functions the library leaves out.
 *
 * Driven through the real engine rather than called directly: what matters is
 * that `=MIN(B2:B6)` typed into a cell produces a number, and that only the
 * whole path can show.
 */

async function sheetWithMarks(): Promise<WorkbookStore> {
  const store = new WorkbookStore();
  await store.ensureEngine();

  store.setCellInput(0, 1, 'Marks');
  [85, 92, 67, 78, 88].forEach((mark, index) => store.setCellInput(index + 1, 1, String(mark)));

  return store;
}

describe('functions fast-formula-parser does not implement', () => {
  it('computes MIN and MAX over a range', async () => {
    const store = await sheetWithMarks();

    store.setCellInput(7, 1, '=MIN(B2:B6)');
    expect(store.activeSheet().getValue(7, 1)).toBe(67);

    store.setCellInput(8, 1, '=MAX(B2:B6)');
    expect(store.activeSheet().getValue(8, 1)).toBe(92);
  });

  it('skips the text header inside the range', async () => {
    // A candidate who selects B1:B6 has included "Marks". Excel ignores it
    // rather than failing, and so must this.
    const store = await sheetWithMarks();
    store.setCellInput(7, 1, '=MIN(B1:B6)');

    expect(store.activeSheet().getValue(7, 1)).toBe(67);
  });

  it('counts non-blank cells with COUNTA, unlike COUNT', async () => {
    const store = await sheetWithMarks();

    store.setCellInput(7, 1, '=COUNTA(B1:B6)');
    expect(store.activeSheet().getValue(7, 1)).toBe(6);

    store.setCellInput(8, 1, '=COUNT(B1:B6)');
    expect(store.activeSheet().getValue(8, 1)).toBe(5);
  });

  it('computes MEDIAN for an odd and an even count', async () => {
    const store = await sheetWithMarks();

    store.setCellInput(7, 1, '=MEDIAN(B2:B6)');
    expect(store.activeSheet().getValue(7, 1)).toBe(85);

    store.setCellInput(7, 1, '=MEDIAN(1,2,3,4)');
    expect(store.activeSheet().getValue(7, 1)).toBe(2.5);
  });

  it('upper-cases text', async () => {
    const store = await sheetWithMarks();
    store.setCellInput(7, 1, '=UPPER("rahul")');

    expect(store.activeSheet().getValue(7, 1)).toBe('RAHUL');
  });

  it('leaves the functions the library does implement alone', async () => {
    // Registering our own must not shadow SUM, AVERAGE or CONCAT.
    const store = await sheetWithMarks();

    store.setCellInput(7, 1, '=SUM(B2:B6)');
    expect(store.activeSheet().getValue(7, 1)).toBe(410);

    store.setCellInput(8, 1, '=CONCAT("Rahul", " ", "Sharma")');
    expect(store.activeSheet().getValue(8, 1)).toBe('Rahul Sharma');
  });
});
