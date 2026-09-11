import { describe, expect, it } from 'vitest';
import { evaluateSheetCriterion } from './evaluate';
import { flattenWorkbook } from './flattenWorkbook';
import type { SheetCriterion } from './criteria';
import { snapshotWorkbook, workbookFromSnapshot, type WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import { Workbook } from '@/spreadsheet/model/Workbook';
import { Worksheet } from '@/spreadsheet/model/Worksheet';
import type { CellStyle } from '@/spreadsheet/model/styles';

/**
 * The Excel marker, checked the way a candidate meets it: a correct answer
 * passes, and every near miss that ought to fail does fail. The near misses
 * matter more than the passes — a marker that is merely generous scores
 * everyone the same.
 */

/** A small sales table, the shape every question in the paper starts from. */
function startingWorkbook(): Workbook {
  const workbook = new Workbook([new Worksheet('sheet1', 'Sheet1')]);
  const sheet = workbook.activeSheet()!;

  sheet.setCell(0, 0, { value: 'Item', styleId: 0 });
  sheet.setCell(0, 1, { value: 'Quantity', styleId: 0 });
  sheet.setCell(0, 2, { value: 'Rate', styleId: 0 });
  sheet.setCell(1, 0, { value: 'Rice', styleId: 0 });
  sheet.setCell(1, 1, { value: 4, styleId: 0 });
  sheet.setCell(1, 2, { value: 55, styleId: 0 });
  sheet.setCell(2, 0, { value: 'Wheat', styleId: 0 });
  sheet.setCell(2, 1, { value: 6, styleId: 0 });
  sheet.setCell(2, 2, { value: 40, styleId: 0 });

  return workbook;
}

const START: WorkbookSnapshot = snapshotWorkbook(startingWorkbook());

/** Applies an edit to a fresh copy of the starting workbook. */
function answered(edit: (workbook: Workbook) => void): WorkbookSnapshot {
  const workbook = workbookFromSnapshot(START);
  edit(workbook);
  return snapshotWorkbook(workbook);
}

function style(workbook: Workbook, row: number, col: number, changes: Partial<CellStyle>): void {
  const sheet = workbook.activeSheet()!;
  const cell = sheet.getCell(row, col);
  sheet.setCell(row, col, {
    value: cell?.value ?? null,
    ...cell,
    styleId: workbook.styles.derive(cell?.styleId ?? 0, changes),
  });
}

function run(criterion: SheetCriterion, submitted: WorkbookSnapshot = START) {
  return evaluateSheetCriterion(criterion, flattenWorkbook(submitted), flattenWorkbook(START));
}

const HEADER_ROW = { start: { row: 0, col: 0 }, end: { row: 0, col: 2 } };

describe('cellValue', () => {
  it('passes when the cell holds the expected value', () => {
    expect(run({ kind: 'cellValue', label: 'x', target: { by: 'cell', row: 1, col: 1 }, equals: 4 }).passed).toBe(true);
  });

  it('fails when it does not, and says what it found', () => {
    const result = run({ kind: 'cellValue', label: 'x', target: { by: 'cell', row: 1, col: 1 }, equals: 9 });

    expect(result.passed).toBe(false);
    expect(result.detail).toContain('B2');
  });

  it('forgives case and stray spaces in typed text', () => {
    // A candidate who typed "total " knows the word.
    const submitted = answered((workbook) => {
      workbook.activeSheet()!.setCell(4, 0, { value: 'total ', styleId: 0 });
    });

    expect(
      run({ kind: 'cellValue', label: 'x', target: { by: 'cell', row: 4, col: 0 }, equals: 'Total' }, submitted).passed,
    ).toBe(true);
  });

  it('accepts a rounded number within tolerance', () => {
    const submitted = answered((workbook) => {
      workbook.activeSheet()!.setCell(4, 1, { value: 5.0, styleId: 0 });
    });

    expect(
      run(
        { kind: 'cellValue', label: 'x', target: { by: 'cell', row: 4, col: 1 }, equals: 5.0001, tolerance: 0.01 },
        submitted,
      ).passed,
    ).toBe(true);
  });
});

describe('cellFormula', () => {
  const sum = (workbook: Workbook) => {
    workbook.activeSheet()!.setCell(3, 1, { value: 10, formula: '=SUM(B2:B3)', styleId: 0 });
  };

  it('passes when the named function is used and the result is right', () => {
    expect(
      run(
        {
          kind: 'cellFormula',
          label: 'x',
          target: { by: 'cell', row: 3, col: 1 },
          usesFunction: 'SUM',
          resultEquals: 10,
        },
        answered(sum),
      ).passed,
    ).toBe(true);
  });

  it('ignores case and spacing in the formula', () => {
    const submitted = answered((workbook) => {
      workbook.activeSheet()!.setCell(3, 1, { value: 10, formula: '= sum( B2:B3 )', styleId: 0 });
    });

    expect(
      run(
        { kind: 'cellFormula', label: 'x', target: { by: 'cell', row: 3, col: 1 }, equals: '=SUM(B2:B3)' },
        submitted,
      ).passed,
    ).toBe(true);
  });

  it('fails a typed-in answer that was not calculated', () => {
    // The question asks for a formula. Typing 10 gets the same number on screen
    // and demonstrates none of the skill being tested.
    const submitted = answered((workbook) => {
      workbook.activeSheet()!.setCell(3, 1, { value: 10, styleId: 0 });
    });

    const result = run(
      { kind: 'cellFormula', label: 'x', target: { by: 'cell', row: 3, col: 1 }, usesFunction: 'SUM' },
      submitted,
    );

    expect(result.passed).toBe(false);
    expect(result.detail).toContain('does not contain a formula');
  });

  it('fails a formula that uses the wrong function', () => {
    const submitted = answered((workbook) => {
      workbook.activeSheet()!.setCell(3, 1, { value: 5, formula: '=AVERAGE(B2:B3)', styleId: 0 });
    });

    expect(
      run(
        { kind: 'cellFormula', label: 'x', target: { by: 'cell', row: 3, col: 1 }, usesFunction: 'SUM' },
        submitted,
      ).passed,
    ).toBe(false);
  });

  it('fails a correct formula that has not calculated', () => {
    const submitted = answered((workbook) => {
      workbook.activeSheet()!.setCell(3, 1, { value: null, formula: '=SUM(B2:B3)', styleId: 0 });
    });

    expect(
      run(
        {
          kind: 'cellFormula',
          label: 'x',
          target: { by: 'cell', row: 3, col: 1 },
          usesFunction: 'SUM',
          resultEquals: 10,
        },
        submitted,
      ).passed,
    ).toBe(false);
  });
});

describe('styled', () => {
  it('passes when every cell in the range carries the format', () => {
    const submitted = answered((workbook) => {
      for (let col = 0; col <= 2; col += 1) style(workbook, 0, col, { bold: true });
    });

    expect(run({ kind: 'styled', label: 'x', target: { by: 'range', range: HEADER_ROW }, style: { bold: true } }, submitted).passed).toBe(true);
  });

  it('fails when one cell of the range was missed', () => {
    // Selecting A1:B1 instead of A1:C1 is the commonest way to get this wrong.
    const submitted = answered((workbook) => {
      style(workbook, 0, 0, { bold: true });
      style(workbook, 0, 1, { bold: true });
    });

    const result = run(
      { kind: 'styled', label: 'x', target: { by: 'range', range: HEADER_ROW }, style: { bold: true } },
      submitted,
    );

    expect(result.passed).toBe(false);
    expect(result.detail).toContain('C1');
  });

  it('accepts either of the alternatives a question allows', () => {
    const submitted = answered((workbook) => style(workbook, 0, 0, { fontColor: '#c00000' }));

    expect(
      run(
        {
          kind: 'styled',
          label: 'x',
          target: { by: 'cell', row: 0, col: 0 },
          style: { fontColor: '#ff0000' },
          anyOf: { property: 'fontColor', values: ['#ff0000', '#c00000'] },
        },
        submitted,
      ).passed,
    ).toBe(true);
  });

  it('does not care what case the colour was written in', () => {
    const submitted = answered((workbook) => style(workbook, 0, 0, { fillColor: '#FFFF00' }));

    expect(
      run({ kind: 'styled', label: 'x', target: { by: 'cell', row: 0, col: 0 }, style: { fillColor: '#ffff00' } }, submitted)
        .passed,
    ).toBe(true);
  });
});

describe('numberFormat, merged, columnWidth, frozen', () => {
  it('checks the number format of a column', () => {
    const submitted = answered((workbook) => {
      style(workbook, 1, 2, { numberFormat: '₹#,##0.00' });
      style(workbook, 2, 2, { numberFormat: '₹#,##0.00' });
    });

    expect(
      run(
        {
          kind: 'numberFormat',
          label: 'x',
          target: { by: 'range', range: { start: { row: 1, col: 2 }, end: { row: 2, col: 2 } } },
          format: '₹#,##0.00',
        },
        submitted,
      ).passed,
    ).toBe(true);
  });

  it('fails when a cell was left on General', () => {
    const submitted = answered((workbook) => style(workbook, 1, 2, { numberFormat: '₹#,##0.00' }));

    expect(
      run(
        {
          kind: 'numberFormat',
          label: 'x',
          target: { by: 'range', range: { start: { row: 1, col: 2 }, end: { row: 2, col: 2 } } },
          format: '₹#,##0.00',
        },
        submitted,
      ).passed,
    ).toBe(false);
  });

  it('checks a merge exists over exactly the asked-for range', () => {
    const submitted = answered((workbook) => {
      workbook.activeSheet()!.mergeCells(HEADER_ROW);
    });

    expect(run({ kind: 'merged', label: 'x', range: HEADER_ROW }, submitted).passed).toBe(true);
    expect(
      run({ kind: 'merged', label: 'x', range: { start: { row: 0, col: 0 }, end: { row: 0, col: 1 } } }, submitted)
        .passed,
    ).toBe(false);
  });

  it('checks a column was widened', () => {
    const submitted = answered((workbook) => workbook.activeSheet()!.setColumnProps(0, { width: 140 }));

    expect(run({ kind: 'columnWidth', label: 'x', col: 0, atLeast: 100 }, submitted).passed).toBe(true);
    expect(run({ kind: 'columnWidth', label: 'x', col: 0, atLeast: 200 }, submitted).passed).toBe(false);
  });

  it('checks the frozen panes', () => {
    const submitted = answered((workbook) => workbook.activeSheet()!.freeze(1, 0));

    expect(run({ kind: 'frozen', label: 'x', rows: 1, columns: 0 }, submitted).passed).toBe(true);
    expect(run({ kind: 'frozen', label: 'x', rows: 2, columns: 0 }, submitted).passed).toBe(false);
  });
});

describe('unchanged', () => {
  const onlyHeaderBold: SheetCriterion = {
    kind: 'unchanged',
    label: 'Nothing was changed beyond what the question asked for',
    except: [{ target: { by: 'range', range: HEADER_ROW }, style: ['bold'] }],
  };

  it('passes when only the asked-for formatting was applied', () => {
    const submitted = answered((workbook) => {
      for (let col = 0; col <= 2; col += 1) style(workbook, 0, col, { bold: true });
    });

    expect(run(onlyHeaderBold, submitted).passed).toBe(true);
  });

  it('fails an extra format on the very cells the question was about', () => {
    // Bold *and* italic when only bold was asked for is not a correct answer
    // with a bonus.
    const submitted = answered((workbook) => {
      for (let col = 0; col <= 2; col += 1) style(workbook, 0, col, { bold: true, italic: true });
    });

    const result = run(onlyHeaderBold, submitted);

    expect(result.passed).toBe(false);
    expect(result.detail).toContain('did not ask for');
  });

  it('fails formatting applied to a cell outside the target', () => {
    const submitted = answered((workbook) => {
      for (let col = 0; col <= 2; col += 1) style(workbook, 0, col, { bold: true });
      style(workbook, 1, 0, { bold: true });
    });

    expect(run(onlyHeaderBold, submitted).detail).toContain('A2');
  });

  it('fails an edited neighbouring cell', () => {
    const submitted = answered((workbook) => {
      workbook.activeSheet()!.setCell(1, 0, { value: 'Barley', styleId: 0 });
    });

    expect(run(onlyHeaderBold, submitted).detail).toContain('contents of A2');
  });

  it('fails a deleted cell', () => {
    // Emptying a cell must not be a way to pass a sweep that only looks at
    // cells the submission still has.
    const submitted = answered((workbook) => workbook.activeSheet()!.setCell(2, 2, undefined));

    expect(run(onlyHeaderBold, submitted).passed).toBe(false);
  });

  it('fails a column widened when nobody asked', () => {
    const submitted = answered((workbook) => workbook.activeSheet()!.setColumnProps(0, { width: 200 }));

    expect(run(onlyHeaderBold, submitted).detail).toContain('Column A');
  });

  it('fails a merge nobody asked for', () => {
    const submitted = answered((workbook) => workbook.activeSheet()!.mergeCells(HEADER_ROW));

    expect(run(onlyHeaderBold, submitted).detail).toContain('merged');
  });

  it('fails frozen panes nobody asked for', () => {
    const submitted = answered((workbook) => workbook.activeSheet()!.freeze(1, 0));

    expect(run(onlyHeaderBold, submitted).detail).toContain('frozen');
  });

  it('allows what the exemption names, and only that', () => {
    const widened: SheetCriterion = {
      kind: 'unchanged',
      label: 'x',
      except: [{ columns: [0] }],
    };
    const submitted = answered((workbook) => workbook.activeSheet()!.setColumnProps(0, { width: 200 }));

    expect(run(widened, submitted).passed).toBe(true);

    const alsoB = answered((workbook) => {
      workbook.activeSheet()!.setColumnProps(0, { width: 200 });
      workbook.activeSheet()!.setColumnProps(1, { width: 200 });
    });
    expect(run(widened, alsoB).passed).toBe(false);
  });

  it('passes an untouched workbook', () => {
    expect(run(onlyHeaderBold).passed).toBe(true);
  });
});
