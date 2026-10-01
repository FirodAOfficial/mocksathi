import { describe, expect, it } from 'vitest';
import { parseTimeline } from '@/exam/document/record';
import { isWorkbookSnapshot, parseWorkbookTimeline } from '@/exam/workbook/record';
import {
  blankSnapshot,
  MAX_SNAPSHOT_CELLS,
  snapshotWorkbook,
  workbookFromSnapshot,
  type WorkbookSnapshot,
} from '@/spreadsheet/model/snapshot';
import { WorkbookStore } from '@/spreadsheet/WorkbookStore';
import { parseDocumentQuestionFields, parseEditorDocument, parsePassage } from './documentPaperInput';
import { parseEditorWorkbook, parseStartingWorkbook } from './workbookPaperInput';

/*
 * What the single-document and single-workbook flows accept from a browser.
 * Everything here arrives from a request — the admin's authoring screen or a
 * candidate's submission — and is checked before any of it reaches the
 * builders, the database or the marker.
 */

function sheet(): WorkbookSnapshot {
  const store = new WorkbookStore();
  store.setCellInput(0, 0, 'Name');
  store.setCellInput(0, 1, 'Fee');
  store.setCellInput(1, 1, '5000');
  return snapshotWorkbook(store.workbook);
}

const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

describe('isWorkbookSnapshot', () => {
  it('accepts a snapshot the spreadsheet produced', () => {
    expect(isWorkbookSnapshot(sheet())).toBe(true);
    expect(isWorkbookSnapshot(blankSnapshot())).toBe(true);
  });

  it.each([
    ['nothing', null],
    ['a string', 'sheets'],
    ['no sheets', { sheets: [] }],
    ['a sheet with no name', { sheets: [{ ...blankSnapshot().sheets[0], name: 7 }] }],
    ['a cell outside the grid', { sheets: [{ ...blankSnapshot().sheets[0], cells: [{ row: -1, col: 0, value: 1 }] }] }],
    ['a cell with an object value', { sheets: [{ ...blankSnapshot().sheets[0], cells: [{ row: 0, col: 0, value: { x: 1 } }] }] }],
    ['a formula that is not text', { sheets: [{ ...blankSnapshot().sheets[0], cells: [{ row: 0, col: 0, value: 1, formula: 5 }] }] }],
    ['a broken merge', { sheets: [{ ...blankSnapshot().sheets[0], merges: [{ start: { row: 0 } }] }] }],
    ['a negative freeze', { sheets: [{ ...blankSnapshot().sheets[0], frozen: { rows: -1, columns: 0 } }] }],
  ])('refuses %s', (_name, value) => {
    expect(isWorkbookSnapshot(value)).toBe(false);
  });

  it('refuses more cells than a snapshot may hold', () => {
    const cells = Array.from({ length: MAX_SNAPSHOT_CELLS + 1 }, (_, index) => ({ row: index, col: 0, value: 1 }));
    expect(isWorkbookSnapshot({ sheets: [{ ...blankSnapshot().sheets[0], cells }] })).toBe(false);
  });
});

describe('timelines', () => {
  it('accepts a workbook timeline', () => {
    expect(parseWorkbookTimeline([{ question: 2, document: sheet() }])).toHaveLength(1);
  });

  it.each([
    ['not a list', { question: 1 }],
    ['a question number of zero', [{ question: 0, document: blankSnapshot() }]],
    ['a fractional question number', [{ question: 1.5, document: blankSnapshot() }]],
    ['a document that is not a workbook', [{ question: 1, document: doc('Hello') }]],
  ])('refuses a workbook timeline that is %s', (_name, value) => {
    expect(parseWorkbookTimeline(value)).toBeNull();
  });

  it('accepts a document timeline and refuses a workbook in it', () => {
    expect(parseTimeline([{ question: 1, document: doc('Hello') }])).toHaveLength(1);
    expect(parseTimeline([{ question: 1, document: blankSnapshot() }])).toBeNull();
  });

  it('caps how long a timeline may be', () => {
    const entry = { question: 1, document: blankSnapshot() };
    expect(parseWorkbookTimeline(Array.from({ length: 401 }, () => entry))).toBeNull();
  });
});

describe('the starting sheet', () => {
  it('is stored normalised', () => {
    const parsed = parseStartingWorkbook(sheet());
    expect(parsed.ok).toBe(true);
    // What a sitting will load: rebuilt through the workbook model and snapshotted again.
    if (parsed.ok) expect(parsed.fields).toEqual(snapshotWorkbook(workbookFromSnapshot(sheet())));
  });

  it('must have something in it', () => {
    expect(parseStartingWorkbook(blankSnapshot())).toMatchObject({ ok: false, code: 'WORKBOOK_REQUIRED' });
  });

  it('must be a workbook', () => {
    expect(parseEditorWorkbook(doc('Hello'))).toMatchObject({ ok: false, code: 'INVALID_WORKBOOK' });
  });
});

describe('the starting passage', () => {
  it('is stored normalised, and must have text', () => {
    expect(parsePassage(doc('Hello world')).ok).toBe(true);
    expect(parsePassage({ type: 'doc', content: [{ type: 'paragraph' }] })).toMatchObject({
      ok: false,
      code: 'PASSAGE_REQUIRED',
    });
  });

  it('must be an editor document', () => {
    expect(parseEditorDocument(blankSnapshot())).toMatchObject({ ok: false, code: 'INVALID_DOCUMENT' });
    expect(parseEditorDocument({ type: 'doc' })).toMatchObject({ ok: false, code: 'INVALID_DOCUMENT' });
  });
});

describe('question fields are checked against the subject’s topic list', () => {
  const base = { instructionEn: 'Bold the header row.', marks: 2, difficulty: 'Medium' };

  it('accepts an Excel topic for an Excel question, and refuses it for Word', () => {
    expect(parseDocumentQuestionFields({ ...base, topics: ['Merge & Center'] }, 'excel')).toMatchObject({ ok: true });
    expect(parseDocumentQuestionFields({ ...base, topics: ['Merge & Center'] }, 'word')).toMatchObject({
      ok: false,
      code: 'INVALID_TOPIC',
    });
  });

  it('falls back to the English question and solution when Hindi is blank', () => {
    const parsed = parseDocumentQuestionFields({ ...base, topics: ['Cell Formatting'], solutionEn: 'Select A1\nBold' }, 'excel');
    expect(parsed.ok && parsed.fields).toMatchObject({
      instructionHi: 'Bold the header row.',
      solutionHi: ['Select A1', 'Bold'],
    });
  });

  it.each([
    ['no marks', { marks: 0 }, 'INVALID_MARKS'],
    ['too many marks', { marks: 101 }, 'INVALID_MARKS'],
    ['an unknown difficulty', { difficulty: 'Extreme' }, 'INVALID_DIFFICULTY'],
    ['no question', { instructionEn: '  ' }, 'INSTRUCTION_REQUIRED'],
  ])('refuses %s', (_name, change, code) => {
    expect(parseDocumentQuestionFields({ ...base, topics: ['Cell Formatting'], ...change }, 'excel')).toMatchObject({
      ok: false,
      code,
    });
  });
});
