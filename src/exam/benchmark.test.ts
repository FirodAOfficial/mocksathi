import { describe, expect, it } from 'vitest';
import {
  applyContribution,
  contributionFor,
  emptyAggregate,
  foldBest,
  isBetter,
  sameContribution,
  withBenchmark,
  type AttemptForBenchmark,
  type BenchmarkAggregate,
  type BenchmarkBest,
  type BenchmarkContribution,
  type Eligibility,
} from './benchmark';
import { QUALIFIED_RESULT, type ExamResult } from './result';

const ALL: Eligibility = { excludeEmpty: false, excludeStaff: false };
const STRICT: Eligibility = { excludeEmpty: true, excludeStaff: true };

function attempt(overrides: Partial<AttemptForBenchmark> & { score?: number; correct?: number; wrong?: number } = {}): AttemptForBenchmark {
  const { score = 20, correct = 5, wrong = 2, ...rest } = overrides;
  return {
    id: 'a1',
    testId: 't1',
    role: 'student',
    you: { score, maxScore: 50, accuracy: (correct / Math.max(1, correct + wrong)) * 100, correct, wrong, unattempted: 15 - correct - wrong, timeSeconds: 300 },
    times: { '1': 30, '2': 0, '3': 45 },
    contribution: null,
    ...rest,
  };
}

function line(score: number, accuracy = 50, timeSeconds = 300): BenchmarkContribution {
  return { score, maxScore: 50, accuracy, correct: 5, wrong: 5, unattempted: 5, timeSeconds, times: {} };
}

describe('contributionFor', () => {
  it('keeps only real per-question times — a question never opened has no time to average', () => {
    expect(contributionFor(attempt(), ALL)?.times).toEqual({ '1': 30, '3': 45 });
  });

  it('leaves out staff and empty sittings only when asked to', () => {
    expect(contributionFor(attempt({ role: 'admin' }), ALL)).not.toBeNull();
    expect(contributionFor(attempt({ role: 'admin' }), STRICT)).toBeNull();
    expect(contributionFor(attempt({ role: 'support' }), STRICT)).toBeNull();
    expect(contributionFor(attempt({ correct: 0, wrong: 0, score: 0 }), ALL)).not.toBeNull();
    expect(contributionFor(attempt({ correct: 0, wrong: 0, score: 0 }), STRICT)).toBeNull();
  });
});

describe('applyContribution', () => {
  it('adds a first sitting, swaps a resit, and subtracts a sitting that stops counting', () => {
    const aggregate = emptyAggregate();
    const first = contributionFor(attempt({ score: 20 }), ALL);
    applyContribution(aggregate, null, first);
    expect(aggregate).toMatchObject({ cohortSize: 1, score: 20 });

    const resit = contributionFor(attempt({ score: 30 }), ALL);
    applyContribution(aggregate, first, resit);
    expect(aggregate).toMatchObject({ cohortSize: 1, score: 30 });

    applyContribution(aggregate, resit, null);
    expect(aggregate.cohortSize).toBe(0);
    expect(aggregate.score).toBe(0);
    expect(aggregate.questionTimes).toEqual({});
  });
});

describe('isBetter', () => {
  it('ranks by score, then accuracy, then the quicker paper', () => {
    expect(isBetter(line(30), line(20))).toBe(true);
    expect(isBetter(line(30, 80), line(30, 60))).toBe(true);
    expect(isBetter(line(30, 80, 200), line(30, 80, 300))).toBe(true);
    expect(isBetter(line(30, 80, 300), line(30, 80, 300))).toBe(false);
  });
});

describe('foldBest', () => {
  const holder: BenchmarkBest = { ...line(40), attemptId: 'top' };

  it('takes a better newcomer', () => {
    expect(foldBest(holder, [{ attemptId: 'new', next: line(45) }])).toMatchObject({ best: { attemptId: 'new', score: 45 }, stale: false });
  });

  it('keeps the holder over a worse newcomer', () => {
    expect(foldBest(holder, [{ attemptId: 'new', next: line(10) }])).toMatchObject({ best: { attemptId: 'top' }, stale: false });
  });

  it('asks for a lookup when the holder resits lower and nothing in the batch reaches the old best', () => {
    const { stale } = foldBest(holder, [{ attemptId: 'top', next: line(10) }]);
    expect(stale).toBe(true);
  });

  it('needs no lookup when the batch itself beats the old best', () => {
    const result = foldBest(holder, [
      { attemptId: 'top', next: line(10) },
      { attemptId: 'other', next: line(48) },
    ]);
    expect(result).toMatchObject({ best: { attemptId: 'other', score: 48 }, stale: false });
  });
});

/**
 * The property the whole design rests on: however sittings arrive — in any
 * batches, with resits, with eligibility flipping — applying each batch
 * incrementally lands on the same figures as computing from scratch.
 */
describe('incremental equals full', () => {
  function seeded(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) % 2 ** 31;
      return state / 2 ** 31;
    };
  }

  function fromScratch(rows: Map<string, AttemptForBenchmark>, eligibility: Eligibility) {
    const aggregate = emptyAggregate();
    let best: BenchmarkBest | null = null;
    for (const row of rows.values()) {
      const c = contributionFor(row, eligibility);
      applyContribution(aggregate, null, c);
      if (c && (!best || isBetter(c, best))) best = { ...c, attemptId: row.id };
    }
    return { aggregate, best };
  }

  function round(aggregate: BenchmarkAggregate) {
    const r = (v: number) => Math.round(v * 1e6) / 1e6;
    return {
      ...aggregate,
      score: r(aggregate.score),
      accuracy: r(aggregate.accuracy),
      timeSeconds: r(aggregate.timeSeconds),
      questionTimes: Object.fromEntries(
        Object.entries(aggregate.questionTimes).map(([k, v]) => [k, { sum: r(v.sum), count: v.count }]),
      ),
    };
  }

  it('holds over 40 random batches of submissions and resits', () => {
    const random = seeded(7);
    const rows = new Map<string, AttemptForBenchmark>();
    const aggregate = emptyAggregate();
    let best: BenchmarkBest | null = null;

    for (let batch = 0; batch < 40; batch++) {
      const touched = new Set<string>();
      for (let i = 0; i < 6; i++) {
        const id = `u${Math.floor(random() * 12)}`;
        const correct = Math.floor(random() * 8);
        const wrong = Math.floor(random() * (15 - correct));
        rows.set(id, {
          ...attempt({ id, score: correct * 3 + Math.round(random() * 10) / 10, correct, wrong }),
          role: random() < 0.15 ? 'admin' : 'student',
          times: { '1': Math.floor(random() * 60), '2': Math.floor(random() * 60) },
          contribution: rows.get(id)?.contribution ?? null,
        });
        touched.add(id);
      }

      // One incremental run over just the touched rows.
      const changes: { attemptId: string; next: BenchmarkContribution | null }[] = [];
      for (const id of touched) {
        const row = rows.get(id)!;
        const next = contributionFor(row, STRICT);
        if (sameContribution(row.contribution, next)) continue;
        applyContribution(aggregate, row.contribution, next);
        changes.push({ attemptId: id, next });
        row.contribution = next;
      }
      const folded = foldBest(best, changes);
      best = folded.stale ? fromScratch(rows, STRICT).best : folded.best;

      const truth = fromScratch(rows, STRICT);
      expect(round(aggregate)).toEqual(round(truth.aggregate));
      expect(best?.score ?? null).toEqual(truth.best?.score ?? null);
    }
  });
});

describe('withBenchmark', () => {
  const base: ExamResult = { ...QUALIFIED_RESULT, topper: null, average: null, benchmark: undefined };

  function aggregateOf(...lines: BenchmarkContribution[]) {
    const aggregate = emptyAggregate();
    for (const l of lines) applyContribution(aggregate, null, l);
    return aggregate;
  }

  it('withholds the comparison below the minimum cohort, and says how far off it is', () => {
    const shown = withBenchmark(base, {
      aggregate: aggregateOf(line(30)),
      best: { ...line(30), attemptId: 'x' },
      computedAt: null,
      minCohortSize: 3,
    });
    expect(shown.topper).toBeNull();
    expect(shown.average).toBeNull();
    expect(shown.benchmark).toEqual({ cohortSize: 1, minCohortSize: 3, computedAt: null });
    expect(shown.questions.every((q) => q.averageTimeSeconds === null && q.topperTimeSeconds === null)).toBe(true);
  });

  it('fills in the best sitting and the cohort means, per question too', () => {
    const a = { ...line(40, 80, 400), times: { '1': 20, '2': 40 } };
    const b = { ...line(20, 40, 200), times: { '1': 40 } };
    const shown = withBenchmark(base, {
      aggregate: aggregateOf(a, b),
      best: { ...a, attemptId: 'a' },
      computedAt: new Date('2026-10-01T10:00:00Z'),
      minCohortSize: 2,
    });

    expect(shown.topper).toMatchObject({ score: 40, accuracy: 80, maxScore: 50 });
    expect(shown.average).toMatchObject({ score: 30, accuracy: 60, timeSeconds: 300 });
    expect(shown.questions[0]).toMatchObject({ averageTimeSeconds: 30, topperTimeSeconds: 20 });
    // Only one candidate spent time on Q2, so that one is the average.
    expect(shown.questions[1]).toMatchObject({ averageTimeSeconds: 40, topperTimeSeconds: 40 });
    expect(shown.questions[2]).toMatchObject({ averageTimeSeconds: null, topperTimeSeconds: null });
    expect(shown.benchmark?.computedAt).toBe('2026-10-01T10:00:00.000Z');
  });

  it('replaces whatever comparison a stored result was saved with', () => {
    const shown = withBenchmark(QUALIFIED_RESULT, null);
    expect(shown.topper).toBeNull();
    expect(shown.you).toEqual(QUALIFIED_RESULT.you);
  });
});
