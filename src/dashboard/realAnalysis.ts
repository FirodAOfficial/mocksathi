import 'server-only';
import { allAttemptsForUser, type StoredAttempt } from '@/db/attempts';
import type { Subject } from '@/exam/types';
import type { PerformanceSnapshot, SubjectSnapshot } from './types';

/**
 * Real (non-fixture) candidate analytics, computed from `test_attempts`.
 *
 * `SEED_DASHBOARD.performance`/`.subjects` (`seedDashboard.ts`) describe an
 * exam this app doesn't actually give — four SSC-style subjects (Reasoning,
 * General Knowledge, …) and a percentile/rank against a candidate cohort
 * that has never existed. This module replaces both with what a Word/Excel
 * efficiency candidate's real sittings can honestly show: real score,
 * accuracy and time figures, and a real Word-vs-Excel breakdown — dropping
 * (not inventing) the figures that need data nobody has yet, like a
 * week-over-week trend or a cross-candidate benchmark. See
 * `PerformanceSnapshot`/`SubjectSnapshot` in `types.ts` for exactly which
 * fields that leaves optional.
 */

const SUBJECT_META: Record<Subject, { label: string; color: string }> = {
  word: { label: 'Word Efficiency', color: '#2563eb' },
  excel: { label: 'Excel Efficiency', color: '#16a34a' },
};

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * The dashboard-home and Performance-page KPI figures.
 *
 * `averageScore` is expressed as an average percentage (so `maxScore` is a
 * flat 100) rather than raw marks — real papers carry different totals
 * (a 50-mark practical today, a 100-mark full paper tomorrow), and a raw
 * "average marks out of X" stops meaning anything once X isn't the same
 * paper twice. A percentage still is.
 */
export function performanceSnapshotFromAttempts(attempts: StoredAttempt[]): PerformanceSnapshot {
  if (attempts.length === 0) {
    return { averageScore: 0, maxScore: 100, accuracyPct: 0, attemptRatePct: 0, avgTimePerQuestionSeconds: 0 };
  }

  const scorePcts = attempts.map((attempt) => (attempt.score / attempt.maxScore) * 100);
  const attemptRates = attempts.map((attempt) => {
    const { correct, wrong } = attempt.result.you;
    return (attempt.result.totalQuestions === 0 ? 0 : ((correct + wrong) / attempt.result.totalQuestions) * 100);
  });
  const timePerQuestion = attempts.map((attempt) =>
    attempt.result.totalQuestions === 0 ? 0 : attempt.result.you.timeSeconds / attempt.result.totalQuestions,
  );

  return {
    averageScore: Math.round(average(scorePcts) * 10) / 10,
    maxScore: 100,
    accuracyPct: Math.round(average(attempts.map((attempt) => attempt.accuracyPct)) * 10) / 10,
    attemptRatePct: Math.round(average(attemptRates) * 10) / 10,
    avgTimePerQuestionSeconds: Math.round(average(timePerQuestion)),
  };
}

/** One row per subject this candidate has actually sat a paper in — 'word' and/or 'excel', never both fixed at once. */
export function subjectSnapshotsFromAttempts(attempts: StoredAttempt[]): SubjectSnapshot[] {
  const bySubject = new Map<Subject, StoredAttempt[]>();
  for (const attempt of attempts) {
    const group = bySubject.get(attempt.subject);
    if (group) group.push(attempt);
    else bySubject.set(attempt.subject, [attempt]);
  }

  return (['word', 'excel'] as const)
    .filter((subject) => bySubject.has(subject))
    .map((subject) => {
      const group = bySubject.get(subject)!;
      return {
        subject: SUBJECT_META[subject].label,
        avgMarks: Math.round(average(group.map((attempt) => attempt.score)) * 10) / 10,
        maxMarks: Math.round(average(group.map((attempt) => attempt.maxScore))),
        accuracyPct: Math.round(average(group.map((attempt) => attempt.accuracyPct)) * 10) / 10,
        avgTimeSeconds: Math.round(average(group.map((attempt) => attempt.result.you.timeSeconds))),
        color: SUBJECT_META[subject].color,
      };
    });
}

export interface RealAnalysis {
  mocksAttempted: number;
  performance: PerformanceSnapshot;
  subjects: SubjectSnapshot[];
}

export async function realAnalysisForUser(userId: string): Promise<RealAnalysis> {
  const attempts = await allAttemptsForUser(userId);
  return {
    mocksAttempted: attempts.length,
    performance: performanceSnapshotFromAttempts(attempts),
    subjects: subjectSnapshotsFromAttempts(attempts),
  };
}
