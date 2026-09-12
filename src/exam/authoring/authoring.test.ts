import { describe, expect, it } from 'vitest';
import { INDENT_STEP_PX } from '@/utils/indent';
import {
  buildExcelQuestion,
  buildWordQuestion,
  cellValueOf,
  excelModelAnswer,
  passageDocument,
  range,
  rangeFromA1,
  rangeToA1,
  sheetFromGrid,
  workbookFromGrid,
  wordModelAnswer,
  type ExcelQuestionDraft,
  type WordQuestionDraft,
} from './index';

/**
 * The builders decide what a question *means*: the model answer a candidate is
 * shown after the paper closes is derived from the operations, never typed in
 * beside them. A question that asks for bold and shows an italic worked answer
 * is the bug class this file exists to catch, and no screen test would see it.
 */

const WORD_BASE: Omit<WordQuestionDraft, 'operations' | 'scope'> = {
  subject: 'word',
  number: 1,
  topic: 'Character Formatting',
  difficulty: 'Easy',
  instruction: { en: 'Make the paragraph bold.', hi: 'पैराग्राफ को बोल्ड करें।' },
  solution: { en: ['Click Bold.'], hi: ['Bold पर क्लिक करें।'] },
  lines: { en: ['A short passage.'], hi: ['A short passage.'] },
  marks: 3,
};

describe('passageDocument', () => {
  it('makes one paragraph per line', () => {
    expect(passageDocument('One', 'Two')).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'One' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Two' }] },
      ],
    });
  });

  it('leaves a blank line as an empty paragraph rather than a paragraph of nothing', () => {
    expect(passageDocument('')).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [] }] });
  });
});

describe('wordModelAnswer', () => {
  it('turns character operations into marks', () => {
    expect(wordModelAnswer([{ kind: 'bold' }, { kind: 'underline' }], 'all')).toEqual({
      scope: 'all',
      marks: [{ type: 'bold' }, { type: 'underline' }],
    });
  });

  it('collects every textStyle operation into one mark', () => {
    // Two textStyle marks on the same text is not something the editor
    // produces, and a model answer carrying two would render only the last.
    const answer = wordModelAnswer(
      [
        { kind: 'fontFamily', family: 'Calibri' },
        { kind: 'fontSize', size: 15 },
        { kind: 'fontColor', color: '#ff0000' },
      ],
      'all',
    );

    expect(answer.marks).toEqual([
      { type: 'textStyle', attrs: { fontFamily: 'Calibri', fontSize: '15pt', color: '#ff0000' } },
    ]);
  });

  it('turns paragraph operations into attributes, not marks', () => {
    expect(wordModelAnswer([{ kind: 'align', align: 'center' }], 'all')).toEqual({
      scope: 'all',
      attrs: { textAlign: 'center' },
    });
    expect(wordModelAnswer([{ kind: 'lineHeight', value: 2 }], 'all').attrs).toEqual({ lineHeight: 2 });
    expect(wordModelAnswer([{ kind: 'indent', levels: 2 }], 'all').attrs).toEqual({ indentLeft: INDENT_STEP_PX * 2 });
  });

  it('scopes marks to a character range, but not paragraph attributes', () => {
    // Word has no way to centre half a line, so a block-level operation applies
    // to the block however the question was scoped.
    const answer = wordModelAnswer([{ kind: 'underline' }, { kind: 'align', align: 'justify' }], { from: 92, to: 178 });

    expect(answer.scope).toEqual({ from: 92, to: 178 });
    expect(answer.marks).toEqual([{ type: 'underline' }]);
    expect(answer.attrs).toEqual({ textAlign: 'justify' });
  });

  it('leaves marks and attrs off entirely when nothing was asked for', () => {
    expect(wordModelAnswer([], 'all')).toEqual({ scope: 'all' });
  });
});

describe('buildWordQuestion', () => {
  it('builds the passage in both languages and derives the model answer', () => {
    const question = buildWordQuestion({ ...WORD_BASE, scope: 'all', operations: [{ kind: 'bold' }] });

    expect(question.subject).toBe('word');
    expect(question.passage.en).toEqual(passageDocument('A short passage.'));
    expect(question.passage.hi).toEqual(passageDocument('A short passage.'));
    expect(question.modelAnswer).toEqual({ scope: 'all', marks: [{ type: 'bold' }] });
  });

  it('starts every question unflagged — bookmarking is the candidate’s, not the author’s', () => {
    expect(buildWordQuestion({ ...WORD_BASE, scope: 'all', operations: [{ kind: 'bold' }] }).bookmarked).toBe(false);
  });
});

describe('cellValueOf', () => {
  it('reads a number as a number, so a formula has something to compute with', () => {
    expect(cellValueOf('5000')).toBe(5000);
    expect(cellValueOf('-2.5')).toBe(-2.5);
  });

  it('keeps everything else as text', () => {
    expect(cellValueOf('Rahul')).toBe('Rahul');
    expect(cellValueOf('STU1101')).toBe('STU1101');
    // An id that happens to be digits is still a label to Excel only if typed
    // as one; here it reads as a number, which is the documented rule.
    expect(cellValueOf('101')).toBe(101);
  });

  it('treats an empty cell as empty, not as an empty string', () => {
    expect(cellValueOf('')).toBeNull();
    expect(cellValueOf('   ')).toBeNull();
  });
});

describe('sheetFromGrid', () => {
  it('places only the cells that hold something', () => {
    const sheet = sheetFromGrid([
      ['Name', 'Fee'],
      ['Rahul', '5000'],
      ['', ''],
    ]);

    expect(sheet.sheets[0]!.cells).toEqual([
      { row: 0, col: 0, value: 'Name' },
      { row: 0, col: 1, value: 'Fee' },
      { row: 1, col: 0, value: 'Rahul' },
      { row: 1, col: 1, value: 5000 },
    ]);
  });

  it('applies a non-default starting view, for a question whose task is to restore it', () => {
    const sheet = sheetFromGrid([['Sales']], { showHeadings: false });
    expect(sheet.sheets[0]!.view).toEqual({ showGridlines: true, showHeadings: false });
  });
});

describe('excelModelAnswer', () => {
  it('merges and centres together, which is what the one button does', () => {
    expect(excelModelAnswer([{ kind: 'merge', range: range(0, 0, 0, 3), centre: true }])).toEqual({
      merges: [range(0, 0, 0, 3)],
      styles: [{ range: range(0, 0, 0, 3), style: { horizontalAlignment: 'center' } }],
    });
  });

  it('merges each row separately for Merge Across', () => {
    expect(excelModelAnswer([{ kind: 'merge', range: range(0, 0, 1, 3), across: true }])).toEqual({
      merges: [range(0, 0, 0, 3), range(1, 0, 1, 3)],
    });
  });

  it('gives an outside border four edges and no interior', () => {
    const answer = excelModelAnswer([{ kind: 'outsideBorder', range: range(0, 0, 5, 3) }]);
    const edge = { style: 'thin', color: '#000000' };

    // All Borders is the answer to a different question, so the interior must
    // stay clear — four one-cell-thick strips, never one uniform style.
    expect(answer.styles).toEqual([
      { range: range(0, 0, 0, 3), style: { borders: { top: edge } } },
      { range: range(5, 0, 5, 3), style: { borders: { bottom: edge } } },
      { range: range(0, 0, 5, 0), style: { borders: { left: edge } } },
      { range: range(0, 3, 5, 3), style: { borders: { right: edge } } },
    ]);
  });

  it('carries a formula and the value it works out to', () => {
    expect(
      excelModelAnswer([{ kind: 'values', cells: [{ row: 7, col: 1, value: 67, formula: '=MIN(B2:B6)' }] }]),
    ).toEqual({ cells: [{ row: 7, col: 1, value: 67, formula: '=MIN(B2:B6)' }] });
  });

  it('keeps the operation kind out of the sheet view it sets', () => {
    expect(excelModelAnswer([{ kind: 'view', showHeadings: true }])).toEqual({ view: { showHeadings: true } });
  });

  it('accumulates several operations into one answer', () => {
    const answer = excelModelAnswer([
      { kind: 'merge', range: range(0, 0, 0, 4), centre: true },
      { kind: 'style', range: range(0, 0, 0, 4), style: { fillColor: '#ffff00' } },
      { kind: 'printArea', range: range(0, 0, 4, 3) },
    ]);

    expect(answer.merges).toHaveLength(1);
    expect(answer.styles).toHaveLength(2);
    expect(answer.printArea).toEqual(range(0, 0, 4, 3));
  });

  it('distinguishes clearing the print area from not mentioning it', () => {
    expect(excelModelAnswer([{ kind: 'printArea', range: null }]).printArea).toBeNull();
    expect(excelModelAnswer([]).printArea).toBeUndefined();
  });
});

describe('buildExcelQuestion', () => {
  const EXCEL_BASE: Omit<ExcelQuestionDraft, 'operations'> = {
    subject: 'excel',
    number: 1,
    topic: 'Merge & Center',
    difficulty: 'Easy',
    instruction: { en: 'Merge and center A1:D1.', hi: 'A1:D1 को Merge & Center करें।' },
    solution: { en: ['Click Merge & Center.'], hi: ['Merge & Center पर क्लिक करें।'] },
    workbook: workbookFromGrid({ en: [['Student Report']], hi: [['छात्र रिपोर्ट']] }),
    marks: 3,
  };

  it('gives each language its own sheet, so work on one cannot leak into the other', () => {
    const question = buildExcelQuestion({ ...EXCEL_BASE, operations: [{ kind: 'merge', range: range(0, 0, 0, 3) }] });

    expect(question.workbook.en.sheets[0]!.cells[0]!.value).toBe('Student Report');
    expect(question.workbook.hi.sheets[0]!.cells[0]!.value).toBe('छात्र रिपोर्ट');
    expect(question.workbook.en).not.toBe(question.workbook.hi);
  });

  it('derives the model answer from the operations', () => {
    const question = buildExcelQuestion({ ...EXCEL_BASE, operations: [{ kind: 'merge', range: range(0, 0, 0, 3) }] });
    expect(question.modelAnswer).toEqual({ merges: [range(0, 0, 0, 3)] });
  });
});

describe('A1 addresses', () => {
  it('round-trips a range', () => {
    expect(rangeToA1(range(0, 0, 5, 3))).toBe('A1:D6');
    expect(rangeFromA1('A1:D6')).toEqual(range(0, 0, 5, 3));
  });

  it('writes a one-cell range as one address', () => {
    expect(rangeToA1(range(7, 1, 7, 1))).toBe('B8');
    expect(rangeFromA1('B8')).toEqual(range(7, 1, 7, 1));
  });

  it('normalises a range typed backwards', () => {
    expect(rangeFromA1('D6:A1')).toEqual(range(0, 0, 5, 3));
  });

  it('accepts lower case and surrounding space', () => {
    expect(rangeFromA1('  a1:d6 ')).toEqual(range(0, 0, 5, 3));
  });

  it('refuses what is not a plain rectangle', () => {
    // A whole-column reference would name a million rows; a `$` anchor and a
    // sheet prefix mean nothing to a question.
    expect(rangeFromA1('A:A')).toBeNull();
    expect(rangeFromA1('$A$1')).toBeNull();
    expect(rangeFromA1('Sheet1!A1')).toBeNull();
    expect(rangeFromA1('')).toBeNull();
    expect(rangeFromA1('A0')).toBeNull();
  });
});
