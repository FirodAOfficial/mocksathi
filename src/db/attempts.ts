import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import type { ExamResult } from '@/exam/result';
import type { Language, Subject } from '@/exam/types';
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
  result: ExamResult;
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
    result: row.result as ExamResult,
    submittedAt: row.submittedAt,
  };
}

/**
 * Records this as the candidate's latest sitting of `testId`.
 *
 * Upserted on `(userId, testId)`: a resit replaces the stored score and
 * result rather than piling up a history nothing reads yet, so "the score"
 * for a paper always means the most recent attempt.
 */
export async function recordAttempt(params: {
  userId: string;
  testId: string;
  subject: Subject;
  language: Language;
  result: ExamResult;
}): Promise<void> {
  const { userId, testId, subject, language, result } = params;
  const now = new Date();
  const shared = {
    subject,
    language,
    score: result.you.score,
    maxScore: result.you.maxScore,
    accuracyPct: result.you.accuracy,
    result,
    submittedAt: now,
    updatedAt: now,
  };

  await db
    .insert(testAttempts)
    .values({ userId, testId, ...shared })
    .onConflictDoUpdate({
      target: [testAttempts.userId, testAttempts.testId],
      set: shared,
    });
}

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
 * Every one of this candidate's attempts among `testIds`, keyed by test id.
 *
 * One query for a whole mocks list rather than one per row — `publishedTestRows`
 * (`src/db/tests.ts`) looks a candidate's own score up here instead of per test.
 */
export async function attemptsForUser(userId: string, testIds: string[]): Promise<Map<string, StoredAttempt>> {
  if (testIds.length === 0) return new Map();

  const rows = await db
    .select()
    .from(testAttempts)
    .where(and(eq(testAttempts.userId, userId), inArray(testAttempts.testId, testIds)));

  return new Map(rows.map((row) => [row.testId, fromRow(row)]));
}
