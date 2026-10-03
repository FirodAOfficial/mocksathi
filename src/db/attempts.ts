import 'server-only';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { cache } from 'react';
import type { ExamResult, ScoreLine } from '@/exam/result';
import type { AnswerPayload, Language, Subject } from '@/exam/types';
import { db } from './client';
import { testAttempts, type TestAttemptRow } from './schema';

/**
 * Reading and writing a candidate's stored sittings.
 *
 * One row per `(user, test)` — see `testAttempts` in `schema.ts` for why a
 * resit overwrites rather than accumulates. Nothing here reaches the browser
 * directly (`import 'server-only'`): the pages and routes that use it decide
 * what a candidate is shown, same as `src/db/tests.ts`.
 */

/** A stored attempt, `result` reconciled back to `ExamResult` — see `schema.ts` for why the column itself is untyped `jsonb`. */
export interface StoredAttempt {
  id: string;
  testId: string;
  subject: Subject;
  language: Language;
  score: number;
  maxScore: number;
  accuracyPct: number;
  /** How many times this candidate has submitted this paper, including this sitting. */
  attemptCount: number;
  result: ExamResult;
  /** What the candidate submitted, for the solutions review's "your answer". */
  answers: Record<number, AnswerPayload>;
  submittedAt: Date;
}

function fromRow(row: TestAttemptRow): StoredAttempt {
  return {
    id: row.id,
    testId: row.testId,
    subject: row.subject,
    language: row.language as Language,
    score: row.score,
    maxScore: row.maxScore,
    accuracyPct: row.accuracyPct,
    attemptCount: row.attemptCount,
    result: row.result as ExamResult,
    answers: row.answers as Record<number, AnswerPayload>,
    submittedAt: row.submittedAt,
  };
}

/**
 * Records this as the candidate's latest sitting of `testId`.
 *
 * Upserted on `(userId, testId)`: a resit replaces the stored score and
 * result rather than piling up a history nothing reads yet, so "the score"
 * for a paper always means the most recent attempt. `attemptCount` is the
 * exception — it accumulates (`+ 1` in the same `UPDATE`, so two concurrent
 * resubmissions can't both read the same starting count and undercount) even
 * though everything else about the row is overwritten, so it still answers
 * "how many times has this candidate sat this paper".
 */
export async function recordAttempt(params: {
  userId: string;
  testId: string;
  subject: Subject;
  language: Language;
  result: ExamResult;
  answers: Record<number, AnswerPayload>;
}): Promise<void> {
  const { userId, testId, subject, language, result, answers } = params;
  const now = new Date();
  const shared = {
    subject,
    language,
    score: result.you.score,
    maxScore: result.you.maxScore,
    accuracyPct: result.you.accuracy,
    result,
    answers,
    submittedAt: now,
    // The database's clock, not this server's: the benchmark run
    // (`src/db/benchmarks.ts`) finds changed rows by comparing this against
    // its own `now()`, and a skewed app clock would hide a row from it.
    updatedAt: sql`now()`,
  };

  await db
    .insert(testAttempts)
    .values({ userId, testId, attemptCount: 1, ...shared })
    .onConflictDoUpdate({
      target: [testAttempts.userId, testAttempts.testId],
      set: { ...shared, attemptCount: sql`${testAttempts.attemptCount} + 1` },
    });
}

/**
 * A stored sitting as a list needs it: the score columns and `result.you`,
 * without the submitted answers or the per-question feedback. Those two jsonb
 * values are most of a row's size, and the dashboard lists every sitting a
 * candidate has — over a database a few hundred milliseconds away, shipping
 * them just to read a score was a measurable part of each page load.
 */
export interface AttemptSummary {
  id: string;
  testId: string;
  subject: Subject;
  score: number;
  maxScore: number;
  accuracyPct: number;
  attemptCount: number;
  result: { you: ScoreLine; totalQuestions: number };
  submittedAt: Date;
}

/**
 * Every one of this candidate's stored sittings, newest first, as summaries.
 *
 * The one query behind both the dashboard's mocks list (`publishedTestRows`)
 * and its analytics (`src/dashboard/realAnalysis.ts`) — `cache()`d, so a page
 * showing both makes one round trip. One row per distinct paper sat, same set
 * `attemptedTestCountForUser` counts.
 */
export const allAttemptsForUser = cache(async (userId: string): Promise<AttemptSummary[]> => {
  const rows = await db
    .select({
      id: testAttempts.id,
      testId: testAttempts.testId,
      subject: testAttempts.subject,
      score: testAttempts.score,
      maxScore: testAttempts.maxScore,
      accuracyPct: testAttempts.accuracyPct,
      attemptCount: testAttempts.attemptCount,
      you: sql<ScoreLine>`${testAttempts.result} -> 'you'`,
      totalQuestions: sql<number>`(${testAttempts.result} ->> 'totalQuestions')::int`,
      submittedAt: testAttempts.submittedAt,
    })
    .from(testAttempts)
    .where(eq(testAttempts.userId, userId))
    .orderBy(desc(testAttempts.submittedAt));

  return rows.map(({ you, totalQuestions, ...row }) => ({
    ...row,
    result: { you, totalQuestions: totalQuestions ?? 0 },
  }));
});

/** This candidate's latest attempt at one paper, or null if they have not sat it. */
export async function attemptFor(userId: string, testId: string): Promise<StoredAttempt | null> {
  const [row] = await db
    .select()
    .from(testAttempts)
    .where(and(eq(testAttempts.userId, userId), eq(testAttempts.testId, testId)))
    .limit(1);

  return row ? fromRow(row) : null;
}

/**
 * How many distinct papers this candidate has ever sat — one row per
 * `(user, test)` (`schema.ts`), so a retake never inflates this. This is the
 * real number behind the free-tier "X of Y mocks used" figure; see
 * `src/dashboard/mockLimit.ts`.
 *
 * Wrapped in React's `cache()`, same reasoning as `currentPlanForUser`
 * (`src/db/plans.ts`): the dashboard layout and the page it wraps both need
 * this for the same request.
 */
export const attemptedTestCountForUser = cache(async (userId: string): Promise<number> => {
  const [row] = await db.select({ value: count() }).from(testAttempts).where(eq(testAttempts.userId, userId));
  return row?.value ?? 0;
});
