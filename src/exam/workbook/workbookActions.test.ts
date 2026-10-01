import { beforeAll, describe, expect, it } from 'vitest';
import { bordersAt } from '@/components/spreadsheet/ribbon/SheetHomeTab';
import { markAttempt } from '@/exam/marking/markAttempt';
import { segmentsByQuestion } from '@/exam/marking/documentMarker';
import { loadFormulaEvaluator, workbookMarker, type FormulaEvaluator } from '@/exam/marking/sheet/workbookMarker';
import type { AnswerPayload, ExamAttempt } from '@/exam/types';
import { workbookRubricFor } from '@/server/marking/workbookRubric';
import type { RangeAddress } from '@/spreadsheet/model/address';
import { snapshotWorkbook, workbookFromSnapshot, type WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import { WorkbookStore } from '@/spreadsheet/WorkbookStore';
import { applyWorkbookSteps, faithfulWorkbook, projectWorkbook, replayWorkbook } from './apply';
import { describeWorkbookStep, suggestWorkbookInstruction } from './describe';
import { detectWorkbookChanges } from './detect';
import { recordWorkbookQuestion, workbookOverlapWarnings } from './record';
import { workbookTopicsFor } from './topics';
import type { WorkbookStep } from './types';

/*
 * Every spreadsheet action the single-workbook flow can record, end to end in a
 * real `WorkbookStore` driven the way the ribbon drives it. For each one:
 *
 * 1. detected as Excel's standard value, and nothing else;
 * 2. described in the ribbon's words, and given a topic;
 * 3. replayed exactly;
 * 4. marked right whether answered before or after another question on the
 *    same cells;
 * 5. marked wrong for a near miss, and for the right action plus an extra one.
 */

const range = (r1: number, c1: number, r2 = r1, c2 = c1): RangeAddress => ({
  start: { row: r1, col: c1 },
  end: { row: r2, col: c2 },
});

/*  A           B      C
 * 1 Fee Report
 * 2 Name       Fee    Paid
 * 3 Rahul      5000   3000
 * 4 Priya      6000   6000
 * 5 Aman       4000   1000
 */
async function startingSheet(): Promise<WorkbookSnapshot> {
  const store = new WorkbookStore();
  const rows = [['Fee Report'], ['Name', 'Fee', 'Paid'], ['Rahul', '5000', '3000'], ['Priya', '6000', '6000'], ['Aman', '4000', '1000']];
  rows.forEach((cells, row) => cells.forEach((input, col) => store.setCellInput(row, col, input)));
  return snapshotWorkbook(store.workbook);
}

type Action = (store: WorkbookStore) => void | Promise<void>;

/** The workbook after performing `action` on `where`, as the ribbon would. */
async function perform(snapshot: WorkbookSnapshot, where: RangeAddress, action: Action): Promise<WorkbookSnapshot> {
  const store = new WorkbookStore(workbookFromSnapshot(snapshot));
  await store.ensureEngine();
  store.selection.selectRange(where);
  await action(store);
  await store.ensureEngine();
  return snapshotWorkbook(store.workbook);
}

const style =
  (changes: Parameters<WorkbookStore['applyStyle']>[0]): Action =>
  (store) =>
    store.applyStyle(changes, 'Format');
const type =
  (row: number, col: number, input: string): Action =>
  (store) =>
    store.setCellInput(row, col, input);
const borders =
  (preset: string): Action =>
  (store) => {
    const selected = store.selection.getRanges()[0]!;
    store.applyStylePerCell((address) => ({ borders: bordersAt(preset, address, selected) }), 'Borders');
  };
const mergeAndCenter: Action = (store) => {
  store.mergeSelection();
  store.applyStyle({ horizontalAlignment: 'center' }, 'Merge & Center');
};

const HEADERS = range(1, 0, 1, 2);
const FEES = range(2, 1, 4, 1);
const TITLE = range(0, 0, 0, 2);

interface ActionCase {
  name: string;
  where: RangeAddress;
  action: Action;
  /** What detection must read: each step's kind and property/value. */
  standard: (steps: WorkbookStep[]) => void;
  describes: RegExp;
  nearMiss: Action;
  starts?: { where: RangeAddress; action: Action };
  /** Another question answered first. Default: italic on the header row. */
  other?: { where: RangeAddress; action: Action };
}

/** The one style step, with its value on every changed cell. */
function onlyStyle(property: string, value: unknown, cells: number) {
  return (steps: WorkbookStep[]) => {
    expect(steps).toHaveLength(1);
    const [step] = steps;
    expect(step!.kind).toBe('style');
    if (step!.kind !== 'style') return;
    expect(step!.property).toBe(property);
    expect(step!.cells).toHaveLength(cells);
    for (const cell of step!.cells) expect(cell.value).toEqual(value);
  };
}

const ITALIC_HEADERS = { where: HEADERS, action: style({ italic: true }) };

const CASES: ActionCase[] = [
  { name: 'Bold', where: HEADERS, action: style({ bold: true }), standard: onlyStyle('bold', true, 3), describes: /^Bold — A2:C2$/, nearMiss: style({ italic: true }), other: { where: HEADERS, action: style({ fillColor: '#d9e1f2' }) } },
  { name: 'Italic', where: HEADERS, action: style({ italic: true }), standard: onlyStyle('italic', true, 3), describes: /^Italic — A2:C2$/, nearMiss: style({ bold: true }), other: { where: HEADERS, action: style({ bold: true }) } },
  { name: 'Underline', where: HEADERS, action: style({ underline: true }), standard: onlyStyle('underline', true, 3), describes: /^Underline — /, nearMiss: style({ bold: true }) },
  { name: 'Strikethrough', where: HEADERS, action: style({ strikethrough: true }), standard: onlyStyle('strikethrough', true, 3), describes: /^Strikethrough — /, nearMiss: style({ underline: true }) },
  { name: 'Font', where: HEADERS, action: style({ fontFamily: 'Times New Roman' }), standard: onlyStyle('fontFamily', 'Times New Roman', 3), describes: /^Font Times New Roman — /, nearMiss: style({ fontFamily: 'Arial' }) },
  { name: 'Font size', where: HEADERS, action: style({ fontSize: 14 }), standard: onlyStyle('fontSize', 14, 3), describes: /^Font size 14 — /, nearMiss: style({ fontSize: 12 }) },
  { name: 'Font colour', where: HEADERS, action: style({ fontColor: '#ff0000' }), standard: onlyStyle('fontColor', '#ff0000', 3), describes: /^Font colour red — /, nearMiss: style({ fontColor: '#0000ff' }) },
  { name: 'Fill colour', where: HEADERS, action: style({ fillColor: '#ffff00' }), standard: onlyStyle('fillColor', '#ffff00', 3), describes: /^Fill colour yellow — /, nearMiss: style({ fillColor: '#00ff00' }) },
  { name: 'Center', where: HEADERS, action: style({ horizontalAlignment: 'center' }), standard: onlyStyle('horizontalAlignment', 'center', 3), describes: /^Centre — /, nearMiss: style({ horizontalAlignment: 'right' }) },
  { name: 'Middle Align', where: HEADERS, action: style({ verticalAlignment: 'middle' }), standard: onlyStyle('verticalAlignment', 'middle', 3), describes: /^Middle align — /, nearMiss: style({ verticalAlignment: 'top' }) },
  { name: 'Wrap Text', where: HEADERS, action: style({ wrapText: true }), standard: onlyStyle('wrapText', true, 3), describes: /^Wrap Text — /, nearMiss: style({ bold: true }) },
  { name: 'Increase Indent', where: HEADERS, action: style({ indent: 1 }), standard: onlyStyle('indent', 1, 3), describes: /^Indent 1 — /, nearMiss: style({ indent: 2 }) },
  { name: 'Orientation 45°', where: HEADERS, action: style({ textRotation: 45 }), standard: onlyStyle('textRotation', 45, 3), describes: /^Rotate text 45° — /, nearMiss: style({ textRotation: -45 }) },
  { name: 'Superscript', where: HEADERS, action: style({ textEffect: 'superscript' }), standard: onlyStyle('textEffect', 'superscript', 3), describes: /^Superscript — /, nearMiss: style({ textEffect: 'subscript' }) },
  { name: 'Number format 0.00', where: FEES, action: style({ numberFormat: '0.00' }), standard: onlyStyle('numberFormat', '0.00', 3), describes: /^Number format 0\.00 — B3:B5$/, nearMiss: style({ numberFormat: '#,##0' }) },
  { name: 'Currency format', where: FEES, action: style({ numberFormat: '₹#,##0.00' }), standard: onlyStyle('numberFormat', '₹#,##0.00', 3), describes: /^Number format ₹#,##0\.00 — /, nearMiss: style({ numberFormat: '0.00' }) },
  {
    name: 'Outside Borders',
    where: range(1, 0, 4, 2),
    action: borders('outline'),
    standard: (steps) => {
      expect(steps).toHaveLength(1);
      const step = steps[0]!;
      if (step.kind !== 'style') throw new Error('not a style step');
      expect(step.property).toBe('borders');
      // The perimeter only: 8 edge cells of a 4×3 block, not the middle ones.
      expect(step.cells).toHaveLength(10);
      const corner = step.cells.find((cell) => cell.row === 1 && cell.col === 0)!;
      expect(Object.keys(corner.value as object).sort()).toEqual(['left', 'top']);
    },
    describes: /^Borders — A2:C5$/,
    nearMiss: borders('all'),
  },
  { name: 'All Borders', where: HEADERS, action: borders('all'), standard: (steps) => expect(steps[0]).toMatchObject({ kind: 'style', property: 'borders' }), describes: /^Borders — A2:C2$/, nearMiss: borders('outline') },
  { name: 'Remove bold', where: HEADERS, starts: { where: HEADERS, action: style({ bold: true }) }, action: style({ bold: false }), standard: onlyStyle('bold', null, 3), describes: /^Remove bold — /, nearMiss: style({ italic: true }) },
  { name: 'No Fill', where: HEADERS, starts: { where: HEADERS, action: style({ fillColor: '#ffff00' }) }, action: style({ fillColor: undefined }), standard: onlyStyle('fillColor', null, 3), describes: /^No fill — /, nearMiss: style({ fillColor: '#00ff00' }) },
  {
    name: 'Merge & Center',
    where: TITLE,
    action: mergeAndCenter,
    standard: (steps) => {
      expect(steps.find((step) => step.kind === 'merge')).toMatchObject({ merged: true, range: TITLE });
      expect(steps.find((step) => step.kind === 'style')).toMatchObject({ property: 'horizontalAlignment' });
    },
    describes: /Merge cells — A1:C1/,
    nearMiss: (store) => void store.mergeSelection(),
    other: ITALIC_HEADERS,
  },
  {
    name: 'Unmerge',
    where: TITLE,
    starts: { where: TITLE, action: (store) => void store.mergeSelection() },
    action: (store) => store.unmergeSelection(),
    standard: (steps) => expect(steps).toEqual([{ kind: 'merge', range: TITLE, merged: false }]),
    describes: /^Unmerge cells — A1:C1$/,
    nearMiss: style({ horizontalAlignment: 'center' }),
  },
  {
    name: 'Type a value',
    where: range(5, 0),
    action: type(5, 0, 'Total'),
    standard: (steps) => expect(steps).toEqual([{ kind: 'content', cells: [{ row: 5, col: 0, value: 'Total', previous: null }] }]),
    describes: /^Enter “Total” — A6$/,
    nearMiss: type(5, 0, 'Sum'),
  },
  {
    name: 'Change a number',
    where: range(3, 1),
    action: type(3, 1, '6500'),
    standard: (steps) => expect(steps).toEqual([{ kind: 'content', cells: [{ row: 3, col: 1, value: 6500, previous: 6000 }] }]),
    describes: /^Enter 6500 — B4$/,
    nearMiss: type(3, 1, '6000.5'),
  },
  {
    name: 'SUM formula',
    where: range(5, 1),
    action: type(5, 1, '=SUM(B3:B5)'),
    standard: (steps) => expect(steps).toEqual([{ kind: 'content', cells: [{ row: 5, col: 1, value: 15000, formula: '=SUM(B3:B5)', previous: null }] }]),
    describes: /^Formula =SUM\(B3:B5\) — B6$/,
    // Right function, wrong range.
    nearMiss: type(5, 1, '=SUM(B3:B4)'),
    // A question that changes one of the inputs, answered first: the total the
    // admin's sheet showed is no longer the total, and the formula is still right.
    other: { where: range(3, 1), action: type(3, 1, '7000') },
  },
  {
    name: 'Arithmetic formula',
    where: range(2, 3),
    action: type(2, 3, '=B3-C3'),
    standard: (steps) => expect(steps[0]).toMatchObject({ kind: 'content', cells: [{ row: 2, col: 3, value: 2000, formula: '=B3-C3' }] }),
    describes: /^Formula =B3-C3 — D3$/,
    nearMiss: type(2, 3, '=C3-B3'),
    other: { where: range(2, 2), action: type(2, 2, '3500') },
  },
  {
    name: 'Clear contents',
    where: range(4, 2),
    action: (store) => store.clearContents(),
    standard: (steps) => expect(steps).toEqual([{ kind: 'content', cells: [{ row: 4, col: 2, value: null, previous: 1000 }] }]),
    describes: /^Clear the cell — C5$/,
    nearMiss: type(4, 2, '0'),
  },
  {
    name: 'Column width',
    where: range(0, 1),
    action: (store) => store.setColumnWidth(1, 120),
    standard: (steps) => expect(steps).toEqual([{ kind: 'column', col: 1, width: { from: 64, to: 120 } }]),
    describes: /^Widen column — B$/,
    nearMiss: (store) => store.setColumnWidth(2, 120),
  },
  {
    name: 'Row height',
    where: range(0, 0),
    action: (store) => store.setRowHeight(0, 40),
    standard: (steps) => expect(steps).toEqual([{ kind: 'row', row: 0, height: { from: 20, to: 40 } }]),
    describes: /^Increase row height — 1$/,
    nearMiss: (store) => store.setRowHeight(1, 40),
  },
  {
    name: 'Freeze Panes',
    where: range(2, 0),
    action: (store) => store.freezePanes(2, 0),
    standard: (steps) => expect(steps).toEqual([{ kind: 'freeze', rows: 2, columns: 0, previous: { rows: 0, columns: 0 } }]),
    describes: /^Freeze 2 row\(s\) and 0 column\(s\)$/,
    nearMiss: (store) => store.freezePanes(1, 0),
  },
  {
    name: 'Hide gridlines',
    where: range(0, 0),
    action: (store) => store.setSheetView({ showGridlines: false }, 'view.show.gridlines'),
    standard: (steps) => expect(steps).toEqual([{ kind: 'view', showGridlines: false }]),
    describes: /^Hide gridlines$/,
    nearMiss: (store) => store.setSheetView({ showHeadings: false }, 'view.show.headings'),
  },
  {
    name: 'Set Print Area',
    where: range(1, 0, 4, 2),
    action: (store) => store.setPrintArea(range(1, 0, 4, 2)),
    standard: (steps) => expect(steps).toEqual([{ kind: 'printArea', range: range(1, 0, 4, 2), previous: null }]),
    describes: /^Set print area — A2:C5$/,
    nearMiss: (store) => store.setPrintArea(range(0, 0, 4, 2)),
  },
];

/* -- Marking ----------------------------------------------------------------- */

let formulas: FormulaEvaluator | null = null;
let START: WorkbookSnapshot;

beforeAll(async () => {
  formulas = await loadFormulaEvaluator();
  START = await startingSheet();
});

function attemptOf(start: WorkbookSnapshot): ExamAttempt {
  return {
    candidateName: 'Candidate',
    subject: 'excel',
    durationSeconds: 600,
    sections: [
      {
        name: 'Spreadsheet',
        questions: [1, 2].map((number) => ({
          subject: 'excel' as const,
          number,
          topic: 'Cell Formatting',
          difficulty: 'Easy' as const,
          instruction: { en: '', hi: '' },
          solution: { en: [], hi: [] },
          workbook: { en: start, hi: start },
          modelAnswer: {},
          marks: 1,
          bookmarked: false,
        })),
      },
    ],
  };
}

function mark(start: WorkbookSnapshot, questions: WorkbookStep[][], timeline: { question: number; document: WorkbookSnapshot }[]) {
  const answers: Record<number, AnswerPayload> = {};
  for (const [number, segments] of segmentsByQuestion(start, timeline)) {
    answers[number] = { segments } as unknown as AnswerPayload;
  }
  return markAttempt(
    attemptOf(start),
    questions.map((steps, index) => workbookRubricFor(index + 1, steps)) as never,
    { answers, language: 'en', totalTimeSeconds: 0 },
    { topper: {}, average: {}, topperTimePerQuestion: [], averageTimePerQuestion: [] } as never,
    workbookMarker(formulas) as never,
    { testName: '', tagline: '', qualifyingMarks: 0 },
  ).marks;
}

it('loads the formula engine for marking', () => {
  expect(formulas).not.toBeNull();
});

describe.each(CASES.map((entry) => [entry.name, entry] as const))('%s', (_name, entry) => {
  async function record() {
    const before = entry.starts ? await perform(START, entry.starts.where, entry.starts.action) : START;
    const after = await perform(before, entry.where, entry.action);
    const detection = detectWorkbookChanges(projectWorkbook(before), projectWorkbook(after));
    return { before, after, detection };
  }

  it('is detected as the standard value, and nothing else', async () => {
    const { detection } = await record();
    expect(detection.problems).toEqual([]);
    entry.standard(detection.steps);
  });

  it('is described in the ribbon’s words, and given a topic', async () => {
    const { detection } = await record();
    expect(detection.steps.map(describeWorkbookStep).join(' | ')).toMatch(entry.describes);
    expect(workbookTopicsFor(detection.steps).length).toBeGreaterThan(0);
  });

  it('is recorded and replays exactly', async () => {
    const { before, after } = await record();
    const recorded = recordWorkbookQuestion(before, after);
    expect(recorded.ok).toBe(true);
    if (recorded.ok) expect(faithfulWorkbook(before, recorded.steps, after)).toBe(true);
  });

  describe('marking', () => {
    const other = entry.other ?? ITALIC_HEADERS;

    async function paper() {
      const { before, after, detection } = await record();
      const second = await perform(after, other.where, other.action);
      const otherSteps = detectWorkbookChanges(projectWorkbook(after), projectWorkbook(second)).steps;
      return { start: before, questions: [detection.steps, otherSteps] };
    }

    it('is correct when done after another question on the same cells', async () => {
      const { start, questions } = await paper();
      const otherFirst = await perform(start, other.where, other.action);
      const thenThis = await perform(otherFirst, entry.where, entry.action);
      const marks = mark(start, questions, [
        { question: 2, document: otherFirst },
        { question: 1, document: thenThis },
      ]);
      expect(marks.map((entry) => entry.outcome), JSON.stringify(marks.map((entry) => entry.criteria))).toEqual([
        'correct',
        'correct',
      ]);
    });

    it('is correct when done first', async () => {
      const { start, questions } = await paper();
      const thisFirst = await perform(start, entry.where, entry.action);
      const thenOther = await perform(thisFirst, other.where, other.action);
      const marks = mark(start, questions, [
        { question: 1, document: thisFirst },
        { question: 2, document: thenOther },
      ]);
      expect(marks.map((entry) => entry.outcome), JSON.stringify(marks.map((entry) => entry.criteria))).toEqual([
        'correct',
        'correct',
      ]);
    });

    it('is incorrect for a near miss', async () => {
      const { start, questions } = await paper();
      const wrong = await perform(start, entry.where, entry.nearMiss);
      expect(mark(start, questions, [{ question: 1, document: wrong }])[0]!.outcome).toBe('incorrect');
    });

    it('is incorrect with an extra change made alongside it', async () => {
      const { start, questions } = await paper();
      const right = await perform(start, entry.where, entry.action);
      const extra = await perform(right, range(4, 0), style({ fillColor: '#ff00ff' }));
      expect(mark(start, questions, [{ question: 1, document: extra }])[0]!.outcome).toBe('incorrect');
    });
  });
});

describe('the rest of the flow', () => {
  it('refuses a change to another sheet', async () => {
    const store = new WorkbookStore(workbookFromSnapshot(START));
    store.addSheet();
    const after = snapshotWorkbook(store.workbook);
    expect(recordWorkbookQuestion(START, after)).toMatchObject({ ok: false, code: 'NOT_RECORDABLE' });
  });

  it('refuses nothing at all', () => {
    expect(recordWorkbookQuestion(START, START)).toMatchObject({ ok: false, code: 'NOTHING_DETECTED' });
  });

  it('does not count a recalculated formula as a change', async () => {
    const withTotal = await perform(START, range(5, 1), type(5, 1, '=SUM(B3:B5)'));
    const changedInput = await perform(withTotal, range(2, 1), type(2, 1, '9000'));
    const { steps } = detectWorkbookChanges(projectWorkbook(withTotal), projectWorkbook(changedInput));
    // Only B3 — not the total below it, whose value moved with it.
    expect(steps).toEqual([{ kind: 'content', cells: [{ row: 2, col: 1, value: 9000, previous: 5000 }] }]);
  });

  it('rebuilds the chain and a single question’s worked answer', async () => {
    const one = await perform(START, HEADERS, style({ bold: true }));
    const two = await perform(one, range(5, 1), type(5, 1, '=SUM(B3:B5)'));
    const q1 = detectWorkbookChanges(projectWorkbook(START), projectWorkbook(one)).steps;
    const q2 = detectWorkbookChanges(projectWorkbook(one), projectWorkbook(two)).steps;
    expect(detectWorkbookChanges(projectWorkbook(replayWorkbook(START, [{ steps: q1 }, { steps: q2 }])), projectWorkbook(two)).steps).toEqual([]);
    const worked = applyWorkbookSteps(START, q2);
    expect(detectWorkbookChanges(projectWorkbook(START), projectWorkbook(worked)).steps).toEqual(q2);
  });

  it('drafts an instruction from what was detected', async () => {
    const after = await perform(START, HEADERS, style({ bold: true }));
    expect(suggestWorkbookInstruction(detectWorkbookChanges(projectWorkbook(START), projectWorkbook(after)).steps)).toBe(
      'Bold in A2:C2.',
    );
  });

  it('warns when two questions set the same cells', async () => {
    const red = await perform(START, HEADERS, style({ fontColor: '#ff0000' }));
    const blue = await perform(red, HEADERS, style({ fontColor: '#0000ff' }));
    const first = detectWorkbookChanges(projectWorkbook(START), projectWorkbook(red)).steps;
    const second = detectWorkbookChanges(projectWorkbook(red), projectWorkbook(blue)).steps;
    expect(workbookOverlapWarnings(second, [{ number: 1, steps: first }])).toHaveLength(1);
  });
});
