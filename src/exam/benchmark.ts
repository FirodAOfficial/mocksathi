import type { ExamResult, ScoreLine } from './result';

/**
 * Best-and-average ("topper" and "average") figures for one paper, computed
 * from real sittings — the pure half. The database half, which decides which
 * sittings to read and when, is `src/db/benchmarks.ts`; the schedule is
 * `src/server/benchmarks/scheduler.ts`. See `sdd/benchmarks.md`.
 *
 * The aggregate is kept as running sums rather than recomputed per read, and
 * each stored attempt remembers exactly what it last added
 * (`test_attempts.benchmark_contribution`). A run then only has to look at the
 * rows that changed since the last one and apply `new - old`: a first sitting
 * adds, a resit swaps its old figures for its new ones, and a row that is no
 * longer eligible subtracts itself. Re-applying the same row is a no-op, which
 * is what lets a run safely re-read a window that overlaps the previous one.
 */

/** What one sitting adds to its paper's aggregate. */
export interface BenchmarkContribution {
  score: number;
  maxScore: number;
  accuracy: number;
  correct: number;
  wrong: number;
  unattempted: number;
  timeSeconds: number;
  /** Seconds spent per question, keyed by question number. */
  times: Record<string, number>;
}

/** Running totals for one paper. Averages are `sum / cohortSize`, worked out on read. */
export interface BenchmarkAggregate {
  cohortSize: number;
  score: number;
  accuracy: number;
  correct: number;
  wrong: number;
  unattempted: number;
  timeSeconds: number;
  /**
   * Per-question time totals. `count` is per question, not `cohortSize`: a
   * question nobody opened has no time to average, and counting it as zero
   * would make an untouched question look like the quickest on the paper.
   */
  questionTimes: Record<string, { sum: number; count: number }>;
}

/** The single best sitting of a paper, and which row it came from. */
export interface BenchmarkBest extends BenchmarkContribution {
  attemptId: string;
}

/** What a result page needs to show "best" and "average" for one paper. */
export interface BenchmarkView {
  aggregate: BenchmarkAggregate;
  best: BenchmarkBest | null;
  computedAt: Date | null;
  /** Below this many candidates the figures are withheld — see `withBenchmark`. */
  minCohortSize: number;
}

export interface Eligibility {
  /** Drop sittings where not one question was answered — an opened-and-submitted paper drags the average toward zero. */
  excludeEmpty: boolean;
  /** Drop admin/support accounts, whose sittings are usually test runs of their own papers. */
  excludeStaff: boolean;
}

export function emptyAggregate(): BenchmarkAggregate {
  return { cohortSize: 0, score: 0, accuracy: 0, correct: 0, wrong: 0, unattempted: 0, timeSeconds: 0, questionTimes: {} };
}

/** A stored sitting as the compute run reads it — only the columns it needs. */
export interface AttemptForBenchmark {
  id: string;
  testId: string;
  role: string;
  /** `result.you`, as stored. */
  you: Pick<ScoreLine, 'score' | 'maxScore' | 'accuracy' | 'correct' | 'wrong' | 'unattempted' | 'timeSeconds'>;
  /** `result.questions[].yourTimeSeconds`, keyed by question number. */
  times: Record<string, number> | null;
  contribution: BenchmarkContribution | null;
}

const STAFF_ROLES = new Set(['admin', 'support']);

/** What this sitting should currently contribute, or null when it should not count at all. */
export function contributionFor(attempt: AttemptForBenchmark, eligibility: Eligibility): BenchmarkContribution | null {
  const { you } = attempt;
  if (eligibility.excludeStaff && STAFF_ROLES.has(attempt.role)) return null;
  if (eligibility.excludeEmpty && you.correct + you.wrong === 0) return null;

  const times: Record<string, number> = {};
  for (const [number, seconds] of Object.entries(attempt.times ?? {})) {
    const value = Number(seconds);
    if (Number.isFinite(value) && value > 0) times[number] = value;
  }

  return {
    score: num(you.score),
    maxScore: num(you.maxScore),
    accuracy: num(you.accuracy),
    correct: num(you.correct),
    wrong: num(you.wrong),
    unattempted: num(you.unattempted),
    timeSeconds: num(you.timeSeconds),
    times,
  };
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function sameContribution(a: BenchmarkContribution | null, b: BenchmarkContribution | null): boolean {
  if (a === null || b === null) return a === b;
  if (
    a.score !== b.score ||
    a.maxScore !== b.maxScore ||
    a.accuracy !== b.accuracy ||
    a.correct !== b.correct ||
    a.wrong !== b.wrong ||
    a.unattempted !== b.unattempted ||
    a.timeSeconds !== b.timeSeconds
  ) {
    return false;
  }
  const aKeys = Object.keys(a.times);
  if (aKeys.length !== Object.keys(b.times).length) return false;
  return aKeys.every((key) => a.times[key] === b.times[key]);
}

/** Moves `aggregate` from counting `previous` to counting `next`, in place. Either side may be null (not counted). */
export function applyContribution(
  aggregate: BenchmarkAggregate,
  previous: BenchmarkContribution | null,
  next: BenchmarkContribution | null,
): void {
  if (previous) addTo(aggregate, previous, -1);
  if (next) addTo(aggregate, next, 1);
}

function addTo(aggregate: BenchmarkAggregate, c: BenchmarkContribution, sign: 1 | -1): void {
  aggregate.cohortSize += sign;
  aggregate.score += sign * c.score;
  aggregate.accuracy += sign * c.accuracy;
  aggregate.correct += sign * c.correct;
  aggregate.wrong += sign * c.wrong;
  aggregate.unattempted += sign * c.unattempted;
  aggregate.timeSeconds += sign * c.timeSeconds;
  for (const [number, seconds] of Object.entries(c.times)) {
    const slot = aggregate.questionTimes[number] ?? { sum: 0, count: 0 };
    slot.sum += sign * seconds;
    slot.count += sign;
    if (slot.count <= 0) delete aggregate.questionTimes[number];
    else aggregate.questionTimes[number] = slot;
  }
}

/**
 * Is `a` a better sitting than `b`? Higher score wins; a tie goes to higher
 * accuracy, then to the quicker paper — the same order a candidate would rank
 * two equal scores in.
 */
export function isBetter(a: BenchmarkContribution, b: BenchmarkContribution): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (a.accuracy !== b.accuracy) return a.accuracy > b.accuracy;
  return a.timeSeconds < b.timeSeconds;
}

/**
 * Folds a batch of changed rows into the current best.
 *
 * Returns `stale` when the holder of the current best got worse (a lower
 * resit, or a row that stopped being eligible) and nothing in the batch beats
 * the old figure: the true best is then some row this batch never read, and
 * the caller has to look it up — one indexed query for one paper, rather than
 * rescanning every sitting.
 */
export function foldBest(
  current: BenchmarkBest | null,
  changes: { attemptId: string; next: BenchmarkContribution | null }[],
): { best: BenchmarkBest | null; stale: boolean } {
  let holderDropped = false;
  let best: BenchmarkBest | null = current;

  for (const change of changes) {
    if (current && change.attemptId === current.attemptId) {
      if (!change.next || isBetter(current, change.next)) holderDropped = true;
    }
  }
  if (holderDropped) best = null;

  for (const change of changes) {
    if (!change.next) continue;
    if (!best || isBetter(change.next, best)) best = { ...change.next, attemptId: change.attemptId };
  }

  // The holder only got worse; if nothing in this batch reached the old best,
  // a row outside the batch may sit between the two.
  const stale = holderDropped && current !== null && (best === null || isBetter(current, best));
  return { best, stale };
}

/** `aggregate` as a `ScoreLine` of means, for the comparison. */
export function averageLine(aggregate: BenchmarkAggregate, maxScore: number): ScoreLine {
  const n = aggregate.cohortSize;
  const mean = (sum: number, places: number) => (n === 0 ? 0 : round(sum / n, places));
  return {
    score: mean(aggregate.score, 2),
    maxScore,
    accuracy: mean(aggregate.accuracy, 2),
    correct: mean(aggregate.correct, 1),
    wrong: mean(aggregate.wrong, 1),
    unattempted: mean(aggregate.unattempted, 1),
    timeSeconds: mean(aggregate.timeSeconds, 0),
  };
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * `result` with its best/average comparison filled in from `view`.
 *
 * Applied at read time, every time — the figures stored inside an old
 * `test_attempts.result` were placeholders, and even real ones go stale the
 * moment someone else sits the paper. Below `minCohortSize` candidates the
 * comparison is withheld rather than shown: with two sittings, "the average"
 * is just the other person's score.
 */
export function withBenchmark(result: ExamResult, view: BenchmarkView | null): ExamResult {
  const cohortSize = view?.aggregate.cohortSize ?? 0;
  const minCohortSize = view?.minCohortSize ?? 1;
  const ready = view !== null && view.best !== null && cohortSize >= minCohortSize;
  const computedAt = view?.computedAt ? view.computedAt.toISOString() : null;

  if (!ready) {
    return {
      ...result,
      topper: null,
      average: null,
      benchmark: { cohortSize, minCohortSize, computedAt },
      questions: result.questions.map((q) => ({ ...q, averageTimeSeconds: null, topperTimeSeconds: null })),
    };
  }

  const { aggregate, best } = view;
  const maxScore = result.maximumMarks;
  return {
    ...result,
    topper: {
      score: best!.score,
      maxScore,
      accuracy: best!.accuracy,
      correct: best!.correct,
      wrong: best!.wrong,
      unattempted: best!.unattempted,
      timeSeconds: best!.timeSeconds,
    },
    average: averageLine(aggregate, maxScore),
    benchmark: { cohortSize, minCohortSize, computedAt },
    questions: result.questions.map((q) => {
      const slot = aggregate.questionTimes[String(q.number)];
      return {
        ...q,
        averageTimeSeconds: slot && slot.count > 0 ? Math.round(slot.sum / slot.count) : null,
        topperTimeSeconds: best!.times[String(q.number)] ?? null,
      };
    }),
  };
}
