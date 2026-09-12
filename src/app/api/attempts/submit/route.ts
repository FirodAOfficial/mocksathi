import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/auth/cookies';
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

/** Generous for fifteen short passages, small enough to bound the work. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

interface SubmitBody {
  answers: Record<string, AnswerPayload>;
  subject?: string;
  /** The authored paper that was sat, if any. See `paperForTest`. */
  testId?: string;
  language?: string;
  timePerQuestion?: Record<string, number>;
  totalTimeSeconds?: number;
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
  if (questions.length === 0) return null;

  const identity = paperIdentityFor(test, questions);
  const excel = test.subject === 'excel';

  return {
    attempt: attemptFromTest(test, questions),
    rubrics: rubricsFor(questions.map(draftFromRow)) as unknown as QuestionRubric<never>[],
    marker: (excel ? SHEET_MARKER : WORD_MARKER) as unknown as SubjectMarker<unknown, never>,
    identity,
  };
}

function paperFor(subject: Subject): Paper {
  if (subject === 'excel') {
    return {
      attempt: EXCEL_SEED_ATTEMPT,
      rubrics: EXCEL_QUESTION_BANK as unknown as QuestionRubric<never>[],
      marker: SHEET_MARKER as unknown as SubjectMarker<unknown, never>,
      identity: EXCEL_PAPER,
    };
  }

  return {
    attempt: SEED_ATTEMPT,
    rubrics: QUESTION_BANK as unknown as QuestionRubric<never>[],
    marker: WORD_MARKER as unknown as SubjectMarker<unknown, never>,
    identity: PAPER,
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
  await requireUser();
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

  const { result } = markAttempt(
    paper.attempt,
    paper.rubrics,
    {
      answers: numericKeys(body.answers as Record<string, unknown>) as unknown as Record<number, AnswerPayload>,
      timePerQuestion: numericKeys(body.timePerQuestion) as unknown as Record<number, number>,
      totalTimeSeconds: Number.isFinite(body.totalTimeSeconds) ? Number(body.totalTimeSeconds) : 0,
      // The starting passage or workbook differs by language, so marking must
      // begin from the one the candidate actually saw.
      language: isLanguage(body.language) ? body.language : 'en',
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

  // Only the result crosses back — never the criteria, which would leak the key.
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
