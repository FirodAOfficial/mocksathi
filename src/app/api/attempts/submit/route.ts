import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/auth/cookies';
import { recordAttempt } from '@/db/attempts';
import { WORD_MARKER } from '@/exam/marking/wordMarker';
import { SHEET_MARKER } from '@/exam/marking/sheet/sheetMarker';
import { markAttempt, validateQuestionBank, type SubjectMarker } from '@/exam/marking/markAttempt';
import type { QuestionRubric } from '@/exam/marking/criteria';
import {
  EXCEL_PAPER,
  PAPER,
  REFERENCE_AVERAGE,
  REFERENCE_AVERAGE_TIMES,
  REFERENCE_TOPPER,
  REFERENCE_TOPPER_TIMES,
} from '@/exam/result';
import { EXCEL_SEED_ATTEMPT } from '@/exam/excelSeedAttempt';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { isLanguage, type AnswerPayload, type ExamAttempt, type Subject } from '@/exam/types';
import { QUESTION_BANK } from '@/server/marking/questionBank';
import { EXCEL_QUESTION_BANK } from '@/server/marking/excelQuestionBank';
import { rubricsFor } from '@/server/marking/rubricFromOperations';
import { attemptFromTest, draftFromRow, getTestById, paperIdentityFor, questionsForTest } from '@/db/tests';
import {
  attemptFromDocumentPaper,
  documentPaperIdentity,
  documentRubrics,
  getDocumentPaper,
} from '@/db/documentPapers';
import { parseTimeline } from '@/exam/document/record';
import { documentMarker, lastDocuments, segmentsByQuestion } from '@/exam/marking/documentMarker';
import { allQuestions } from '@/exam/types';
import type { JSONContent } from '@tiptap/core';
import type { Test } from '@/db/schema';
import {
  attemptFromWorkbookPaper,
  getWorkbookPaper,
  workbookPaperIdentity,
  workbookRubrics,
} from '@/db/workbookPapers';
import { loadFormulaEvaluator, workbookMarker } from '@/exam/marking/sheet/workbookMarker';
import { parseWorkbookTimeline } from '@/exam/workbook/record';
import type { WorkbookSnapshot } from '@/spreadsheet/model/snapshot';

/**
 * Marks a submitted paper.
 *
 * The paper and the answer key are both loaded here, not accepted from the
 * request: the client sends only what the candidate produced. Otherwise a
 * candidate could post their own passages, their own marks, or simply a
 * finished result.
 */

// The answer key must never be bundled for the browser, so this cannot run on
// the edge alongside client code.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Generous for fifteen short passages, small enough to bound the work.
 *
 * Raised from 2 MB for single-document papers, whose timeline carries one
 * document per visit that changed something. Kept under Vercel's 4.5 MB
 * request ceiling, past which the platform would refuse the request before it
 * got here.
 */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

interface SubmitBody {
  answers: Record<string, AnswerPayload>;
  subject?: string;
  /** The authored paper that was sat, if any. See `paperForTest`. */
  testId?: string;
  language?: string;
  timePerQuestion?: Record<string, number>;
  totalTimeSeconds?: number;
  /** A single-document paper's sitting, visit by visit. See `TimelineEntry`. */
  timeline?: unknown;
}

/**
 * Everything one paper needs to be marked.
 *
 * Selected here from a two-value enum, never taken from the request. The client
 * says *which* paper it sat; it does not get to supply the questions, the marks
 * or the key.
 */
interface Paper {
  attempt: ExamAttempt;
  // The rubric and projection types differ per subject and are checked inside
  // the marker, so this pair is deliberately opaque at the selection point.
  rubrics: QuestionRubric<never>[];
  marker: SubjectMarker<unknown, never>;
  identity: { testName: string; tagline: string; maximumMarks: number; qualifyingMarks: number };
  subject: Subject;
  /**
   * The stored test being sat, for recording the attempt — null for the
   * fixture sample paper, which has no `tests` row for a score to attach to.
   */
  testId: string | null;
  /**
   * Set for a single-document paper: the passage the candidate's timeline
   * starts from. Its presence is what marks the timeline instead of
   * `answers` — see `answersFromTimeline`.
   */
  passage?: JSONContent;
  /** The same for a single-workbook Excel paper: the sheet its timeline starts from. */
  startWorkbook?: WorkbookSnapshot;
}

/**
 * The authored paper with that id, marked against a key derived from it.
 *
 * The rubrics are *not* stored: they are built from the same `operations` the
 * questions were written with (`rubricsFor`), so a paper cannot be marked
 * against something other than what it showed the candidate. Everything else
 * here is the same rule the fixture path follows — the questions, the marks and
 * the key are all loaded server-side, and the request contributes only an id.
 *
 * Null when the id names nothing, or names a paper with no questions; the
 * caller then falls back to the sample paper rather than 500ing on a test an
 * admin deleted mid-sitting.
 */
async function paperForTest(testId: string): Promise<Paper | null> {
  const test = await getTestById(testId);
  if (!test) return null;

  const questions = await questionsForTest(test.id);
  if (questions.length === 0 && test.subject === 'word') return documentPaperForTest(test);
  if (questions.length === 0 && test.subject === 'excel') return workbookPaperForTest(test);
  if (questions.length === 0) return null;

  const identity = paperIdentityFor(test, questions);
  const excel = test.subject === 'excel';

  return {
    attempt: attemptFromTest(test, questions),
    rubrics: rubricsFor(questions.map(draftFromRow)) as unknown as QuestionRubric<never>[],
    marker: (excel ? SHEET_MARKER : WORD_MARKER) as unknown as SubjectMarker<unknown, never>,
    identity,
    subject: test.subject,
    testId: test.id,
  };
}

/**
 * A single-document Word paper, marked against keys derived from its detected
 * steps (`documentRubrics`) by a marker that reads each question's own visits.
 */
async function documentPaperForTest(test: Test): Promise<Paper | null> {
  const paper = await getDocumentPaper(test.id);
  if (!paper || paper.questions.length === 0) return null;

  return {
    attempt: attemptFromDocumentPaper(test, paper),
    rubrics: documentRubrics(paper) as unknown as QuestionRubric<never>[],
    marker: documentMarker() as unknown as SubjectMarker<unknown, never>,
    identity: documentPaperIdentity(test, paper),
    subject: 'word',
    testId: test.id,
    passage: paper.passage,
  };
}

/**
 * A single-workbook Excel paper. Its marker evaluates formulas itself, on the
 * candidate's own sheet, so the calculation engine is loaded for the request.
 */
async function workbookPaperForTest(test: Test): Promise<Paper | null> {
  const paper = await getWorkbookPaper(test.id);
  if (!paper || paper.questions.length === 0) return null;

  return {
    attempt: attemptFromWorkbookPaper(test, paper),
    rubrics: workbookRubrics(paper) as unknown as QuestionRubric<never>[],
    marker: workbookMarker(await loadFormulaEvaluator()) as unknown as SubjectMarker<unknown, never>,
    identity: workbookPaperIdentity(test, paper),
    subject: 'excel',
    testId: test.id,
    startWorkbook: paper.workbook,
  };
}

/**
 * What `markAttempt` is given for a single-document or single-workbook paper,
 * and what is stored.
 *
 * Marked: each question's visits, rebuilt into before/after pairs from the
 * server's own starting point. Stored: each question's last document or
 * workbook, which the review screen shows as "your answer" — the visit chain is
 * only needed to mark, and would be most of the row.
 */
function answersFromAnyTimeline<T>(
  attempt: ExamAttempt,
  start: T,
  timeline: { question: number; document: T }[],
): { marking: Record<number, AnswerPayload>; stored: Record<number, AnswerPayload> } {
  const numbers = new Set(allQuestions(attempt).map((question) => question.number));
  const marking: Record<number, AnswerPayload> = {};
  for (const [number, segments] of segmentsByQuestion(start, timeline)) {
    if (numbers.has(number)) marking[number] = { segments } as unknown as AnswerPayload;
  }
  const stored: Record<number, AnswerPayload> = {};
  for (const [key, document] of Object.entries(lastDocuments(timeline))) {
    if (numbers.has(Number(key))) stored[Number(key)] = document as unknown as AnswerPayload;
  }
  return { marking, stored };
}

function paperFor(subject: Subject): Paper {
  if (subject === 'excel') {
    return {
      attempt: EXCEL_SEED_ATTEMPT,
      rubrics: EXCEL_QUESTION_BANK as unknown as QuestionRubric<never>[],
      marker: SHEET_MARKER as unknown as SubjectMarker<unknown, never>,
      identity: EXCEL_PAPER,
      subject: 'excel',
      testId: null,
    };
  }

  return {
    attempt: SEED_ATTEMPT,
    rubrics: QUESTION_BANK as unknown as QuestionRubric<never>[],
    marker: WORD_MARKER as unknown as SubjectMarker<unknown, never>,
    identity: PAPER,
    subject: 'word',
    testId: null,
  };
}

function isSubject(value: unknown): value is Subject {
  return value === 'word' || value === 'excel';
}

function badRequest(detail: string): NextResponse {
  return NextResponse.json({ code: 'INVALID_SUBMISSION', detail }, { status: 400 });
}

function numericKeys(source: Record<string, unknown> | undefined): Record<number, never> {
  const output: Record<number, never> = {};
  for (const [key, value] of Object.entries(source ?? {})) {
    const number = Number.parseInt(key, 10);
    if (Number.isInteger(number)) (output as Record<number, unknown>)[number] = value;
  }
  return output;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await requireUser();
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ code: 'TOO_LARGE', detail: 'The submission is too large.' }, { status: 413 });
  }

  let body: SubmitBody;
  try {
    body = JSON.parse(raw) as SubmitBody;
  } catch {
    return badRequest('The submission is not valid JSON.');
  }

  if (!body || typeof body !== 'object' || typeof body.answers !== 'object' || body.answers === null) {
    return badRequest('The submission has no answers.');
  }

  // An authored paper when one was sat, the sample paper otherwise — which is
  // also what a submission from before `testId` existed gets, and what a paper
  // deleted mid-sitting falls back to. An unknown subject means the Word paper,
  // which is what a bare `/exam` has always been.
  const subject: Subject = isSubject(body.subject) ? body.subject : 'word';
  const paper = (typeof body.testId === 'string' ? await paperForTest(body.testId) : null) ?? paperFor(subject);

  // A mis-authored paper would mark everyone wrongly and silently; fail loudly.
  const problems = validateQuestionBank(paper.attempt, paper.rubrics, paper.identity.maximumMarks);
  if (problems.length > 0) {
    return NextResponse.json(
      { code: 'PAPER_INVALID', detail: problems.join(' ') },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }

  const language = isLanguage(body.language) ? body.language : 'en';
  let answers = numericKeys(body.answers as Record<string, unknown>) as unknown as Record<number, AnswerPayload>;
  let storedAnswers = answers;

  // A single-document paper is marked from its timeline, never from `answers`:
  // a question's answer there is a visit, not a document.
  if (paper.passage) {
    const timeline = body.timeline === undefined ? [] : parseTimeline(body.timeline);
    if (!timeline) return badRequest('The submission timeline is not valid.');
    const built = answersFromAnyTimeline(paper.attempt, paper.passage, timeline);
    answers = built.marking;
    storedAnswers = built.stored;
  } else if (paper.startWorkbook) {
    const timeline = body.timeline === undefined ? [] : parseWorkbookTimeline(body.timeline);
    if (!timeline) return badRequest('The submission timeline is not valid.');
    const built = answersFromAnyTimeline(paper.attempt, paper.startWorkbook, timeline);
    answers = built.marking;
    storedAnswers = built.stored;
  }

  const { result } = markAttempt(
    paper.attempt,
    paper.rubrics,
    {
      answers,
      timePerQuestion: numericKeys(body.timePerQuestion) as unknown as Record<number, number>,
      totalTimeSeconds: Number.isFinite(body.totalTimeSeconds) ? Number(body.totalTimeSeconds) : 0,
      // The starting passage or workbook differs by language, so marking must
      // begin from the one the candidate actually saw.
      language,
    },
    {
      topper: REFERENCE_TOPPER,
      average: REFERENCE_AVERAGE,
      topperTimePerQuestion: [...REFERENCE_TOPPER_TIMES],
      averageTimePerQuestion: [...REFERENCE_AVERAGE_TIMES],
    },
    paper.marker,
    {
      testName: paper.identity.testName,
      tagline: paper.identity.tagline,
      qualifyingMarks: paper.identity.qualifyingMarks,
    },
  );

  // Stored against the paper actually sat, never the sample: there is no
  // `tests` row for that one to attach a score to, and it always stands for a
  // fresh database rather than a candidate's own progress.
  if (paper.testId) {
    await recordAttempt({
      userId: user.id,
      testId: paper.testId,
      subject: paper.subject,
      language,
      result,
      answers: storedAnswers,
    });
  }

  // Only the result crosses back — never the criteria, which would leak the key.
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
