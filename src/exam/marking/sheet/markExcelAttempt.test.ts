import { describe, expect, it } from 'vitest';
import {
  DUE_FEES,
  EXCEL_SEED_ATTEMPT,
  FULL_NAMES,
  PREFIXED_IDS,
  TARGETS,
} from '@/exam/excelSeedAttempt';
import {
  EXCEL_PAPER,
  REFERENCE_AVERAGE,
  REFERENCE_AVERAGE_TIMES,
  REFERENCE_TOPPER,
  REFERENCE_TOPPER_TIMES,
} from '@/exam/result';
import { findQuestion, isExcelQuestion, type Language } from '@/exam/types';
import { EXCEL_QUESTION_BANK, excelRubricFor } from '@/server/marking/excelQuestionBank';
import { markAttempt, markQuestion, validateQuestionBank } from '../markAttempt';
import { SHEET_MARKER } from './sheetMarker';
import { WorkbookStore } from '@/spreadsheet/WorkbookStore';
import { snapshotWorkbook, workbookFromSnapshot, type WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import type { RangeAddress } from '@/spreadsheet/model/address';
import type { CellStyle } from '@/spreadsheet/model/styles';

/**
 * The supplied Excel paper, marked the way it will actually be marked.
 *
 * The load-bearing test of the whole Excel flow, and deliberately an
 * integration test rather than unit tests over hand-written snapshots: it
 * drives a **real `WorkbookStore`** through the same calls the ribbon buttons
 * make, snapshots the result, and marks it. If the ribbon, the style registry,
 * the formula engine or the snapshot format changes shape, this fails — instead
 * of every candidate being silently marked wrong.
 *
 * Every question has a correct case *and* a near miss. A marker that only ever
 * says yes scores everyone the same.
 */

function openQuestion(number: number, language: Language = 'en'): WorkbookStore {
  const question = findQuestion(EXCEL_SEED_ATTEMPT, number);
  if (!question || !isExcelQuestion(question)) throw new Error(`no Excel question ${number}`);

  return new WorkbookStore(workbookFromSnapshot(question.workbook[language]));
}

/** Selecting a range and clicking a ribbon control — the candidate's route. */
function format(store: WorkbookStore, target: RangeAddress, style: Partial<CellStyle>): void {
  store.selection.selectRange(target);
  store.applyStyle(style, 'Format', 'home.font');
}

function range(startRow: number, startCol: number, endRow: number, endCol: number): RangeAddress {
  return { start: { row: startRow, col: startCol }, end: { row: endRow, col: endCol } };
}

function cell(row: number, col: number): RangeAddress {
  return range(row, col, row, col);
}

const THIN = { style: 'thin' as const, color: '#000000' };

/** What Home ▸ Borders ▸ Outside Borders does, edge by edge. */
function outsideBorder(store: WorkbookStore, target: RangeAddress): void {
  store.selection.selectRange(target);
  store.applyStylePerCell(
    (address) => {
      const borders: CellStyle['borders'] = {};
      if (address.row === target.start.row) borders.top = THIN;
      if (address.row === target.end.row) borders.bottom = THIN;
      if (address.col === target.start.col) borders.left = THIN;
      if (address.col === target.end.col) borders.right = THIN;
      return { borders: Object.keys(borders).length > 0 ? borders : undefined };
    },
    'Outside Borders',
    'home.font.borders',
  );
}

function mark(number: number, store: WorkbookStore, language: Language = 'en') {
  const question = findQuestion(EXCEL_SEED_ATTEMPT, number)!;
  return markQuestion(question, excelRubricFor(number), snapshotWorkbook(store.workbook), SHEET_MARKER, language);
}

/** The answer a candidate who did exactly what was asked would produce. */
const CORRECT: Record<number, (store: WorkbookStore) => void | Promise<void>> = {
  1: (store) => {
    store.selection.selectRange(TARGETS.q1Title);
    store.mergeSelection();
    store.applyStyle({ horizontalAlignment: 'center' }, 'Merge & Center', 'home.alignment.merge');
  },
  2: (store) => format(store, TARGETS.q2Title, { fontFamily: 'Calibri', fontSize: 20, bold: true }),
  3: (store) =>
    format(store, TARGETS.q3Header, {
      fontColor: '#002060',
      fillColor: '#ffff00',
      fontSize: 19,
      italic: true,
    }),
  4: (store) => outsideBorder(store, TARGETS.q4Table),
  5: (store) => format(store, TARGETS.q5Fees, { numberFormat: '₹#,##0', fillColor: '#e36c0a' }),
  6: (store) => PREFIXED_IDS.forEach((id, index) => store.setCellInput(index + 1, 0, id)),
  7: async (store) => {
    await store.ensureEngine();
    for (let index = 0; index < FULL_NAMES.length; index += 1) {
      store.setCellInput(index + 1, 3, `=CONCAT(B${index + 2}," ",C${index + 2})`);
    }
  },
  8: async (store) => {
    await store.ensureEngine();
    for (let index = 0; index < DUE_FEES.length; index += 1) {
      store.setCellInput(index + 1, 3, `=B${index + 2}-C${index + 2}`);
    }
  },
  // Dragging the fill handle from A2 down to A13, which is what the question asks for.
  9: (store) => {
    store.fillFrom(cell(1, 0), range(1, 0, 12, 0));
  },
  10: async (store) => {
    await store.ensureEngine();
    store.setCellInput(TARGETS.q10Minimum.row, TARGETS.q10Minimum.col, '=MIN(B2:B6)');
  },
  11: async (store) => {
    await store.ensureEngine();
    store.setCellInput(TARGETS.q11Maximum.row, TARGETS.q11Maximum.col, '=MAX(B2:B6)');
  },
  12: (store) => {
    store.selection.selectRange(TARGETS.q12Across);
    store.mergeAcross();
  },
  13: (store) => {
    store.selection.selectRange(TARGETS.q13Heading);
    store.mergeSelection();
    store.applyStyle(
      { horizontalAlignment: 'center', textEffect: 'subscript', fillColor: '#ffff00' },
      'Merge & Center',
      'home.alignment.merge',
    );
  },
  14: (store) => store.setSheetView({ showHeadings: true }, 'view.show.headings'),
  15: (store) => {
    store.setPrintArea(TARGETS.q15PrintArea);
  },
};

describe('the Excel paper is well formed', () => {
  it('has an answer key for every question, adding up to the advertised total', () => {
    expect(
      validateQuestionBank(EXCEL_SEED_ATTEMPT, EXCEL_QUESTION_BANK, EXCEL_PAPER.maximumMarks),
    ).toEqual([]);
  });

  it('gives every question its own workbook', () => {
    // Shared workbooks would let work on one question appear in another.
    const first = findQuestion(EXCEL_SEED_ATTEMPT, 1)!;
    const second = findQuestion(EXCEL_SEED_ATTEMPT, 2)!;
    if (!isExcelQuestion(first) || !isExcelQuestion(second)) throw new Error('expected Excel questions');

    expect(first.workbook.en).not.toBe(second.workbook.en);
  });

  it('uses the same numbers and addresses in both languages', () => {
    // One answer key marks both papers, which only holds if the data and the
    // cell addresses are identical and only the labels differ.
    const question = findQuestion(EXCEL_SEED_ATTEMPT, 4)!;
    if (!isExcelQuestion(question)) throw new Error('expected an Excel question');

    const numbers = (snapshot: WorkbookSnapshot) =>
      snapshot.sheets[0]!.cells
        .filter((entry) => typeof entry.value === 'number')
        .map((entry) => `${entry.row},${entry.col}=${String(entry.value)}`);

    expect(numbers(question.workbook.hi)).toEqual(numbers(question.workbook.en));
    expect(question.workbook.hi.sheets[0]!.cells[0]!.value).not.toBe(
      question.workbook.en.sheets[0]!.cells[0]!.value,
    );
  });

  it('starts question 14 with the headings hidden, so there is something to do', () => {
    const question = findQuestion(EXCEL_SEED_ATTEMPT, 14)!;
    if (!isExcelQuestion(question)) throw new Error('expected an Excel question');

    expect(question.workbook.en.sheets[0]!.view.showHeadings).toBe(false);
  });
});

describe('marking a correct answer', () => {
  for (const number of Object.keys(CORRECT).map(Number)) {
    it(`awards question ${number} when the asked-for operation is performed`, async () => {
      const store = openQuestion(number);
      await CORRECT[number]!(store);

      const result = mark(number, store);

      expect(result.criteria.filter((entry) => !entry.passed)).toEqual([]);
      expect(result.outcome).toBe('correct');
    });
  }

  it('marks the Hindi paper with the same key', async () => {
    const store = openQuestion(4, 'hi');
    await CORRECT[4]!(store);

    expect(mark(4, store, 'hi').outcome).toBe('correct');
  });
});

describe('marking a near miss', () => {
  it('fails Merge & Center applied to the wrong range', () => {
    const store = openQuestion(1);
    store.selection.selectRange(range(0, 0, 0, 2));
    store.mergeSelection();
    store.applyStyle({ horizontalAlignment: 'center' }, 'Merge & Center', 'home.alignment.merge');

    expect(mark(1, store).outcome).toBe('incorrect');
  });

  it('fails an extra format alongside the right one', () => {
    // Bold as well as the three properties asked for is not a bonus.
    const store = openQuestion(3);
    format(store, TARGETS.q3Header, {
      fontColor: '#002060',
      fillColor: '#ffff00',
      fontSize: 19,
      italic: true,
      bold: true,
    });

    const result = mark(3, store);

    expect(result.outcome).toBe('incorrect');
    expect(result.criteria.some((entry) => !entry.passed && entry.detail?.includes('did not ask for'))).toBe(true);
  });

  it('fails All Borders where an outside border was asked for', () => {
    // The commonest wrong answer to question 4, and the one a uniform style
    // check would have passed.
    const store = openQuestion(4);
    format(store, TARGETS.q4Table, {
      borders: { top: THIN, right: THIN, bottom: THIN, left: THIN },
    });

    const result = mark(4, store);

    expect(result.outcome).toBe('incorrect');
    expect(result.criteria.some((entry) => entry.detail?.includes('All Borders'))).toBe(true);
  });

  it('fails currency that still shows decimal places', () => {
    const store = openQuestion(5);
    format(store, TARGETS.q5Fees, { numberFormat: '₹#,##0.00', fillColor: '#e36c0a' });

    expect(mark(5, store).outcome).toBe('incorrect');
  });

  it('fails a typed-in full name where CONCAT was asked for', async () => {
    // Identical on the sheet, and demonstrates none of the skill being tested.
    const store = openQuestion(7);
    await store.ensureEngine();
    FULL_NAMES.forEach((name, index) => store.setCellInput(index + 1, 3, name));

    expect(mark(7, store).outcome).toBe('incorrect');
  });

  it('fails a fill that stopped short', () => {
    const store = openQuestion(9);
    store.fillFrom(cell(1, 0), range(1, 0, 6, 0));

    expect(mark(9, store).outcome).toBe('incorrect');
  });

  it('fails MAX where MIN was asked for', async () => {
    const store = openQuestion(10);
    await store.ensureEngine();
    store.setCellInput(TARGETS.q10Minimum.row, TARGETS.q10Minimum.col, '=MAX(B2:B6)');

    expect(mark(10, store).outcome).toBe('incorrect');
  });

  it('fails Merge & Center where Merge Across was asked for', () => {
    // One merged cell spanning both rows, instead of one merge per row. The
    // two commands are not interchangeable and neither are their answers.
    const store = openQuestion(12);
    store.selection.selectRange(TARGETS.q12Across);
    store.mergeSelection();

    expect(mark(12, store).outcome).toBe('incorrect');
  });

  it('fails the subscript question when the effect is missing', () => {
    const store = openQuestion(13);
    store.selection.selectRange(TARGETS.q13Heading);
    store.mergeSelection();
    store.applyStyle(
      { horizontalAlignment: 'center', fillColor: '#ffff00' },
      'Merge & Center',
      'home.alignment.merge',
    );

    expect(mark(13, store).outcome).toBe('incorrect');
  });

  it('fails showing the gridlines when the headings were asked for', () => {
    const store = openQuestion(14);
    store.setSheetView({ showGridlines: false }, 'view.show.gridlines');

    expect(mark(14, store).outcome).toBe('incorrect');
  });

  it('fails a print area that swallows the Month table', () => {
    const store = openQuestion(15);
    store.setPrintArea(range(0, 0, 4, 6));

    const result = mark(15, store);

    expect(result.outcome).toBe('incorrect');
    expect(result.criteria.some((entry) => entry.detail?.includes('print area is'))).toBe(true);
  });

  it('reports an untouched question as unattempted, not wrong', () => {
    // Blank is not the same as wrong, and the result screen shows them apart.
    const question = findQuestion(EXCEL_SEED_ATTEMPT, 1)!;

    expect(markQuestion(question, excelRubricFor(1), undefined, SHEET_MARKER, 'en').outcome).toBe(
      'unattempted',
    );
  });
});

describe('markAttempt over the Excel paper', () => {
  it('scores a paper where three questions were answered correctly', async () => {
    const answers: Record<number, WorkbookSnapshot> = {};

    for (const number of [1, 8, 15]) {
      const store = openQuestion(number);
      await CORRECT[number]!(store);
      answers[number] = snapshotWorkbook(store.workbook);
    }

    const { result } = markAttempt(
      EXCEL_SEED_ATTEMPT,
      EXCEL_QUESTION_BANK,
      { answers, language: 'en', totalTimeSeconds: 900 },
      {
        topper: REFERENCE_TOPPER,
        average: REFERENCE_AVERAGE,
        topperTimePerQuestion: REFERENCE_TOPPER_TIMES,
        averageTimePerQuestion: REFERENCE_AVERAGE_TIMES,
      },
      SHEET_MARKER,
      EXCEL_PAPER,
    );

    expect(result.you).toMatchObject({ correct: 3, wrong: 0, unattempted: 12 });
    // Q1 and Q15 are 3 marks each, Q8 is 4.
    expect(result.you.score).toBe(10);
    expect(result.maximumMarks).toBe(50);
  });
});
