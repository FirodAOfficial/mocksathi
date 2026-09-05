import { NextResponse, type NextRequest } from 'next/server';
import type { JSONContent } from '@tiptap/core';
import { evaluateCriterion } from '@/exam/marking/evaluate';
import { markAttempt, validateQuestionBank } from '@/exam/marking/markAttempt';
import {
  PAPER,
  REFERENCE_AVERAGE,
  REFERENCE_AVERAGE_TIMES,
  REFERENCE_TOPPER,
  REFERENCE_TOPPER_TIMES,
} from '@/exam/result';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { isLanguage } from '@/exam/types';
import { QUESTION_BANK } from '@/server/marking/questionBank';

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
  answers: Record<string, JSONContent>;
  language?: string;
  timePerQuestion?: Record<string, number>;
  totalTimeSeconds?: number;
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

  // A mis-authored paper would mark everyone wrongly and silently; fail loudly.
  const problems = validateQuestionBank(SEED_ATTEMPT, QUESTION_BANK, PAPER.maximumMarks);
  if (problems.length > 0) {
    return NextResponse.json(
      { code: 'PAPER_INVALID', detail: problems.join(' ') },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }

  const { result } = markAttempt(
    SEED_ATTEMPT,
    QUESTION_BANK,
    {
      answers: numericKeys(body.answers as Record<string, unknown>) as unknown as Record<number, JSONContent>,
      timePerQuestion: numericKeys(body.timePerQuestion) as unknown as Record<number, number>,
      totalTimeSeconds: Number.isFinite(body.totalTimeSeconds) ? Number(body.totalTimeSeconds) : 0,
      // The passage differs by language, so marking must start from the one the
      // candidate actually saw.
      language: isLanguage(body.language) ? body.language : 'en',
    },
    {
      topper: REFERENCE_TOPPER,
      average: REFERENCE_AVERAGE,
      topperTimePerQuestion: [...REFERENCE_TOPPER_TIMES],
      averageTimePerQuestion: [...REFERENCE_AVERAGE_TIMES],
    },
    evaluateCriterion,
    { testName: PAPER.testName, tagline: PAPER.tagline, qualifyingMarks: PAPER.qualifyingMarks },
  );

  // Only the result crosses back — never the criteria, which would leak the key.
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
