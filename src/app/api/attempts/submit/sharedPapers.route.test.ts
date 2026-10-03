import { Editor, type JSONContent } from '@tiptap/core';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Test } from '@/db/schema';
import { buildEditorExtensions } from '@/editor/extensions';
import { project } from '@/exam/document/apply';
import { detectChanges } from '@/exam/document/detect';
import type { ExamResult } from '@/exam/result';
import type { AnswerPayload } from '@/exam/types';
import { projectWorkbook } from '@/exam/workbook/apply';
import { detectWorkbookChanges } from '@/exam/workbook/detect';
import { snapshotWorkbook, workbookFromSnapshot, type WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import { WorkbookStore } from '@/spreadsheet/WorkbookStore';

/*
 * The submit route, for papers written on one document or one workbook.
 *
 * Only the database is mocked — which test, which paper, and where the attempt
 * is recorded. Everything that decides a mark runs for real: rebuilding each
 * question's visits from the server's own starting point, the derived key, the
 * formula engine, and marking.
 */

const db = vi.hoisted(() => ({
  test: null as Test | null,
  workbookPaper: null as unknown,
  documentPaper: null as unknown,
  recorded: [] as { answers: Record<number, AnswerPayload>; result: ExamResult }[],
}));

vi.mock('@/auth/cookies', () => ({
  requireUser: () => Promise.resolve({ id: '00000000-0000-4000-8000-000000000001', role: 'student' }),
}));
vi.mock('@/db/tests', async (importActual) => ({
  ...(await importActual<typeof import('@/db/tests')>()),
  getTestById: () => Promise.resolve(db.test),
  questionsForTest: () => Promise.resolve([]),
}));
vi.mock('@/db/workbookPapers', async (importActual) => ({
  ...(await importActual<typeof import('@/db/workbookPapers')>()),
  getWorkbookPaper: () => Promise.resolve(db.workbookPaper),
}));
vi.mock('@/db/documentPapers', async (importActual) => ({
  ...(await importActual<typeof import('@/db/documentPapers')>()),
  getDocumentPaper: () => Promise.resolve(db.documentPaper),
}));
vi.mock('@/db/attempts', () => ({
  recordAttempt: (attempt: { answers: Record<number, AnswerPayload>; result: ExamResult }) => {
    db.recorded.push(attempt);
    return Promise.resolve();
  },
}));

// No cohort in these tests: the comparison is withheld, which is what a
// paper nobody else has sat shows.
vi.mock('@/db/benchmarks', () => ({ benchmarkViewForTest: () => Promise.resolve(null) }));

const { POST } = await import('./route');

const TEST_ID = '11111111-1111-4111-8111-111111111111';

function testRow(subject: 'word' | 'excel'): Test {
  return {
    id: TEST_ID,
    examId: '22222222-2222-4222-8222-222222222222',
    name: `${subject} paper`,
    slug: `${subject}-paper`,
    subject,
    description: null,
    sectionName: 'Section 1',
    tagline: null,
    durationMinutes: 15,
    qualifyingMarks: 0,
    status: 'published',
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function question<Step>(position: number, steps: Step[]) {
  return {
    id: `q${position}`,
    testId: TEST_ID,
    position,
    topic: 'Cell Formatting',
    difficulty: 'Easy' as const,
    marks: 3,
    instructionEn: `Question ${position}`,
    instructionHi: `Question ${position}`,
    solutionEn: [],
    solutionHi: [],
    steps,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function post(body: unknown): Promise<Response> {
  return POST(
    new NextRequest('http://localhost/api/attempts/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  db.recorded = [];
});

/* -- Excel ------------------------------------------------------------------- */

describe('a single-workbook Excel paper', () => {
  async function perform(snapshot: WorkbookSnapshot, act: (store: WorkbookStore) => void): Promise<WorkbookSnapshot> {
    const store = new WorkbookStore(workbookFromSnapshot(snapshot));
    await store.ensureEngine();
    act(store);
    await store.ensureEngine();
    return snapshotWorkbook(store.workbook);
  }

  const boldHeaders = (store: WorkbookStore) => {
    store.selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 0, col: 1 } });
    store.applyStyle({ bold: true }, 'Bold');
  };
  const total = (store: WorkbookStore) => store.setCellInput(3, 1, '=SUM(B2:B3)');

  let start: WorkbookSnapshot;

  beforeEach(async () => {
    const store = new WorkbookStore();
    for (const [row, col, input] of [
      [0, 0, 'Name'], [0, 1, 'Fee'], [1, 0, 'Rahul'], [1, 1, '5000'], [2, 0, 'Priya'], [2, 1, '6000'],
    ] as const) {
      store.setCellInput(row, col, input);
    }
    start = snapshotWorkbook(store.workbook);

    // Recorded in order: bold the headers, then total the fees.
    const one = await perform(start, boldHeaders);
    const two = await perform(one, total);
    db.test = testRow('excel');
    db.workbookPaper = {
      testId: TEST_ID,
      workbook: start,
      questions: [
        question(1, detectWorkbookChanges(projectWorkbook(start), projectWorkbook(one)).steps),
        question(2, detectWorkbookChanges(projectWorkbook(one), projectWorkbook(two)).steps),
      ],
    };
  });

  it('marks both questions right when answered in the other order', async () => {
    const totalFirst = await perform(start, total);
    const thenBold = await perform(totalFirst, boldHeaders);

    const response = await post({
      answers: {},
      subject: 'excel',
      testId: TEST_ID,
      timeline: [
        { question: 2, document: totalFirst },
        { question: 1, document: thenBold },
      ],
      totalTimeSeconds: 60,
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as ExamResult;
    expect(result.you).toMatchObject({ score: 6, correct: 2, wrong: 0, unattempted: 0 });
  });

  it('cannot be helped by a forged starting point: the server starts from its own sheet', async () => {
    // Bold done alongside an extra fill. A client would like the server to
    // believe the fill was already there; there is nowhere to say so.
    const boldAndFill = await perform(start, (store) => {
      boldHeaders(store);
      store.applyStyle({ fillColor: '#ffff00' }, 'Fill');
    });

    const result = (await (
      await post({ answers: {}, subject: 'excel', testId: TEST_ID, timeline: [{ question: 1, document: boldAndFill }] })
    ).json()) as ExamResult;

    expect(result.questions[0]).toMatchObject({ outcome: 'incorrect' });
    expect(result.you.unattempted).toBe(1);
  });

  it('stores each question’s last workbook as its answer, and ignores questions the paper does not have', async () => {
    const bold = await perform(start, boldHeaders);
    await post({
      answers: {},
      subject: 'excel',
      testId: TEST_ID,
      timeline: [
        { question: 9, document: bold },
        { question: 1, document: bold },
      ],
    });

    expect(db.recorded).toHaveLength(1);
    expect(Object.keys(db.recorded[0]!.answers)).toEqual(['1']);
    expect(db.recorded[0]!.answers[1]).toEqual(bold);
  });

  it('refuses a timeline that is not one', async () => {
    const response = await post({
      answers: {},
      subject: 'excel',
      testId: TEST_ID,
      timeline: [{ question: 1, document: { sheets: [{ name: 'Sheet1', cells: [{ row: -4, col: 0, value: 1 }] }] } }],
    });
    expect(response.status).toBe(400);
    expect(db.recorded).toHaveLength(0);
  });

  it('scores a sitting with nothing recorded as unattempted', async () => {
    const result = (await (await post({ answers: {}, subject: 'excel', testId: TEST_ID })).json()) as ExamResult;
    expect(result.you).toMatchObject({ score: 0, unattempted: 2 });
  });
});

/* -- Word -------------------------------------------------------------------- */

describe('a single-document Word paper', () => {
  const editors: Editor[] = [];
  afterEach(() => {
    while (editors.length) editors.pop()?.destroy();
  });

  const PASSAGE: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The quick brown fox.' }] }],
  };

  /** The passage after one ribbon action on "quick". */
  function perform(document: JSONContent, act: (editor: Editor) => void): JSONContent {
    const element = window.document.createElement('div');
    window.document.body.appendChild(element);
    const editor = new Editor({ element, extensions: buildEditorExtensions(), content: structuredClone(document) });
    editors.push(editor);
    editor.commands.setTextSelection({ from: 5, to: 10 });
    act(editor);
    return editor.getJSON();
  }

  const bold = (editor: Editor) => editor.chain().focus().toggleBold().run();
  const italic = (editor: Editor) => editor.chain().focus().toggleItalic().run();

  beforeEach(() => {
    const one = perform(PASSAGE, bold);
    db.test = testRow('word');
    db.documentPaper = {
      testId: TEST_ID,
      passage: PASSAGE,
      questions: [question(1, detectChanges(project(PASSAGE), project(one)).steps)],
    };
  });

  it('marks a question from its timeline', async () => {
    const result = (await (
      await post({ answers: {}, subject: 'word', testId: TEST_ID, timeline: [{ question: 1, document: perform(PASSAGE, bold) }] })
    ).json()) as ExamResult;
    expect(result.you).toMatchObject({ score: 3, correct: 1 });
  });

  it('marks the wrong button wrong', async () => {
    const result = (await (
      await post({ answers: {}, subject: 'word', testId: TEST_ID, timeline: [{ question: 1, document: perform(PASSAGE, italic) }] })
    ).json()) as ExamResult;
    expect(result.questions[0]).toMatchObject({ outcome: 'incorrect' });
  });

  it('refuses a workbook where a document belongs', async () => {
    const response = await post({
      answers: {},
      subject: 'word',
      testId: TEST_ID,
      timeline: [{ question: 1, document: { sheets: [] } }],
    });
    expect(response.status).toBe(400);
  });
});
