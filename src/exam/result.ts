/**
 * The data a result screen renders.
 *
 * Deliberately flat and self-contained: the screen takes one of these and draws
 * it, with no knowledge of how the paper was sat or how it was marked. That is
 * what lets the same components serve a real submission and the design preview
 * route, and what will let real marking drop in without touching a component.
 */

export type ResultOutcome = 'qualified' | 'not-qualified';

export type QuestionOutcome = 'correct' | 'incorrect' | 'unattempted';

/** One column of the comparison table. */
export interface ScoreLine {
  score: number;
  maxScore: number;
  /** Percent, 0-100. */
  accuracy: number;
  correct: number;
  wrong: number;
  unattempted: number;
  timeSeconds: number;
}

/**
 * One line of "why", for the review screen.
 *
 * These are the marking criteria's own labels, so the candidate is told exactly
 * what was checked. They are sent only with a marked result — the criteria
 * themselves, and the targets and values they check against, stay server-side.
 */
export interface CriterionFeedback {
  label: string;
  passed: boolean;
  /** What went wrong. Absent when the criterion passed. */
  detail?: string;
}

export interface QuestionResult {
  number: number;
  outcome: QuestionOutcome;
  /** Per-criterion verdicts. Absent on the design fixtures, which are not marked. */
  feedback?: CriterionFeedback[];
  yourTimeSeconds: number;
  averageTimeSeconds: number;
  topperTimeSeconds: number;
}

export interface ExamResult {
  testName: string;
  tagline: string;
  totalTimeMinutes: number;
  totalQuestions: number;
  maximumMarks: number;
  qualifyingMarks: number;
  you: ScoreLine;
  topper: ScoreLine;
  average: ScoreLine;
  questions: QuestionResult[];
}

export function outcomeOf(result: ExamResult): ResultOutcome {
  return result.you.score >= result.qualifyingMarks ? 'qualified' : 'not-qualified';
}

/** How far short of qualifying, or 0 once the mark is reached. */
export function marksNeeded(result: ExamResult): number {
  return Math.max(0, round2(result.qualifyingMarks - result.you.score));
}

/** `492` -> `"00:08:12"`. Always hours:minutes:seconds, as the tables show. */
export function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export function percent(value: number, total: number): number {
  return total === 0 ? 0 : round2((value / total) * 100);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/* -------------------------------------------------------------------------
 * Design fixtures
 *
 * The figures from the two approved screens, so either can be opened directly
 * at /result and iterated on without sitting an exam.
 * ---------------------------------------------------------------------- */

export const REFERENCE_TOPPER: ScoreLine = {
  score: 197.5,
  maxScore: 200,
  accuracy: 99,
  correct: 99,
  wrong: 1,
  unattempted: 0,
  timeSeconds: 3600,
};

export const REFERENCE_TOPPER_TIMES = [14, 16, 22, 16, 15, 16, 28, 15, 17, 15, 22, 14, 15, 28, 22];

const C: QuestionOutcome = 'correct';
const X: QuestionOutcome = 'incorrect';
const U: QuestionOutcome = 'unattempted';

function buildQuestions(
  outcomes: QuestionOutcome[],
  yourTimes: number[],
  averageTimes: number[],
): QuestionResult[] {
  return outcomes.map((outcome, index) => ({
    number: index + 1,
    outcome,
    yourTimeSeconds: yourTimes[index] ?? 0,
    averageTimeSeconds: averageTimes[index] ?? 0,
    topperTimeSeconds: REFERENCE_TOPPER_TIMES[index] ?? 0,
  }));
}

const QUALIFIED_YOUR_TIMES = [20, 30, 60, 25, 22, 28, 45, 26, 24, 26, 50, 22, 26, 50, 38];
export const REFERENCE_AVERAGE_TIMES = [28, 32, 45, 30, 28, 30, 52, 28, 32, 28, 45, 26, 28, 52, 41];

/** 11 correct, 3 incorrect, 1 unattempted — matching the headline figures. */
const QUALIFIED_OUTCOMES: QuestionOutcome[] = [C, C, X, C, C, U, X, C, C, C, C, C, C, X, C];

/** Identity and pass mark of the demo paper. */
export const PAPER = {
  testName: 'Rajasthan Efficiency Test - 01',
  tagline: 'Your Progress Brings You Closer to Success',
  maximumMarks: 50,
  qualifyingMarks: 12.5,
} as const;

export const QUALIFIED_RESULT: ExamResult = {
  testName: PAPER.testName,
  tagline: PAPER.tagline,
  totalTimeMinutes: 10,
  totalQuestions: 15,
  maximumMarks: PAPER.maximumMarks,
  qualifyingMarks: PAPER.qualifyingMarks,
  you: {
    score: 28,
    maxScore: 50,
    accuracy: 73.33,
    correct: 11,
    wrong: 3,
    unattempted: 1,
    // Kept equal to the per-question figures, so the chart and the total agree.
    timeSeconds: sum(QUALIFIED_YOUR_TIMES),
  },
  topper: REFERENCE_TOPPER,
  average: {
    score: 22.5,
    maxScore: 50,
    accuracy: 54,
    correct: 8,
    wrong: 6,
    unattempted: 1,
    timeSeconds: sum(REFERENCE_AVERAGE_TIMES),
  },
  questions: buildQuestions(QUALIFIED_OUTCOMES, QUALIFIED_YOUR_TIMES, REFERENCE_AVERAGE_TIMES),
};

const FAILED_YOUR_TIMES = [16, 24, 28, 20, 18, 22, 24, 20, 18, 20, 24, 18, 20, 24, 16];
const FAILED_AVERAGE_TIMES = [24, 28, 40, 26, 24, 26, 44, 26, 28, 24, 40, 22, 26, 44, 18];

/** 6 correct, 8 incorrect, 1 unattempted — matching the headline figures. */
const FAILED_OUTCOMES: QuestionOutcome[] = [C, X, X, C, X, U, X, C, C, X, X, C, X, X, C];

export const NOT_QUALIFIED_RESULT: ExamResult = {
  ...QUALIFIED_RESULT,
  you: {
    score: 8,
    maxScore: 50,
    accuracy: 40,
    correct: 6,
    wrong: 8,
    unattempted: 1,
    timeSeconds: sum(FAILED_YOUR_TIMES),
  },
  average: {
    ...QUALIFIED_RESULT.average,
    timeSeconds: sum(FAILED_AVERAGE_TIMES),
  },
  questions: buildQuestions(FAILED_OUTCOMES, FAILED_YOUR_TIMES, FAILED_AVERAGE_TIMES),
};

export function fixtureFor(outcome: ResultOutcome): ExamResult {
  return outcome === 'qualified' ? QUALIFIED_RESULT : NOT_QUALIFIED_RESULT;
}

/* ---------------------------------------------------------------------- */

/** Cohort figures, until there is a real cohort to compute them from. */
export const REFERENCE_AVERAGE: ScoreLine = QUALIFIED_RESULT.average;
