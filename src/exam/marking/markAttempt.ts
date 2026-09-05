import type { JSONContent } from '@tiptap/core';
import { proseMirrorToDocument } from '@/editor/proseMirrorToDocument';
import type { DocumentMetadata } from '@/services/document/types';
import type { CriterionResult, QuestionRubric } from './criteria';
import { flatten, type FlatDocument } from './flatten';
import { allQuestions, type ExamAttempt, type ExamQuestion, type Language } from '../types';
import {
  formatClock,
  percent,
  type ExamResult,
  type QuestionOutcome,
  type QuestionResult,
  type ScoreLine,
} from '../result';

/** Marking never reads metadata; this satisfies the model's shape. */
const NO_METADATA: DocumentMetadata = {
  title: '',
  format: 'blank',
  sourceUrl: null,
  unsupportedFeatures: [],
};

export interface QuestionMark {
  number: number;
  outcome: QuestionOutcome;
  awarded: number;
  criteria: CriterionResult[];
}

function project(document: JSONContent): FlatDocument {
  return flatten(proseMirrorToDocument(document, NO_METADATA));
}

/**
 * Marks one question, all or nothing.
 *
 * Every criterion must pass for the marks to be awarded. The individual results
 * still come back so the candidate can be told which step they missed — the
 * feedback is per-criterion even though the score is not.
 */
export function markQuestion(
  question: ExamQuestion,
  rubric: QuestionRubric | undefined,
  submitted: JSONContent | undefined,
  evaluate: (
    criterion: QuestionRubric['criteria'][number],
    submittedDoc: FlatDocument,
    startDoc: FlatDocument,
  ) => CriterionResult,
  /** Which passage the candidate was working from. */
  language: Language,
): QuestionMark {
  if (!submitted) {
    return { number: question.number, outcome: 'unattempted', awarded: 0, criteria: [] };
  }

  // A question with no rubric cannot be marked; it is reported rather than
  // silently scored, so a mis-authored paper is visible instead of generous.
  if (!rubric || rubric.criteria.length === 0) {
    return {
      number: question.number,
      outcome: 'incorrect',
      awarded: 0,
      criteria: [{ label: 'Marking unavailable', passed: false, detail: 'No answer key for this question.' }],
    };
  }

  const submittedDoc = project(submitted);
  const startDoc = project(question.passage[language]);
  const criteria = rubric.criteria.map((criterion) => evaluate(criterion, submittedDoc, startDoc));
  const correct = criteria.every((result) => result.passed);

  return {
    number: question.number,
    outcome: correct ? 'correct' : 'incorrect',
    awarded: correct ? question.marks : 0,
    criteria,
  };
}

export interface AttemptSubmission {
  /** Answer documents by question number. Missing means untouched. */
  answers: Record<number, JSONContent>;
  /** The language the paper was sat in. */
  language: Language;
  /** Seconds spent per question, by question number. */
  timePerQuestion?: Record<number, number>;
  totalTimeSeconds: number;
}

export interface MarkedAttempt {
  result: ExamResult;
  marks: QuestionMark[];
}

/** Reference figures until there is a real cohort to compute them from. */
export interface ReferenceLines {
  topper: ScoreLine;
  average: ScoreLine;
  topperTimePerQuestion: number[];
  averageTimePerQuestion: number[];
}

export function markAttempt(
  attempt: ExamAttempt,
  rubrics: QuestionRubric[],
  submission: AttemptSubmission,
  reference: ReferenceLines,
  evaluate: Parameters<typeof markQuestion>[3],
  paper: { testName: string; tagline: string; qualifyingMarks: number },
): MarkedAttempt {
  const questions = allQuestions(attempt);
  const byNumber = new Map(rubrics.map((rubric) => [rubric.number, rubric]));

  const marks = questions.map((question) =>
    markQuestion(
      question,
      byNumber.get(question.number),
      submission.answers[question.number],
      evaluate,
      submission.language,
    ),
  );

  const score = marks.reduce((total, mark) => total + mark.awarded, 0);
  const correct = marks.filter((mark) => mark.outcome === 'correct').length;
  const unattempted = marks.filter((mark) => mark.outcome === 'unattempted').length;
  const wrong = marks.length - correct - unattempted;
  const maximumMarks = totalMarks(attempt);

  const questionResults: QuestionResult[] = questions.map((question, index) => ({
    number: question.number,
    outcome: marks[index]?.outcome ?? 'unattempted',
    yourTimeSeconds: Math.round(submission.timePerQuestion?.[question.number] ?? 0),
    averageTimeSeconds: reference.averageTimePerQuestion[index] ?? 0,
    topperTimeSeconds: reference.topperTimePerQuestion[index] ?? 0,
  }));

  return {
    marks,
    result: {
      testName: paper.testName,
      tagline: paper.tagline,
      totalTimeMinutes: Math.round(attempt.durationSeconds / 60),
      totalQuestions: questions.length,
      maximumMarks,
      qualifyingMarks: paper.qualifyingMarks,
      you: {
        score: Math.round(score * 100) / 100,
        maxScore: maximumMarks,
        // Accuracy is over the questions actually attempted, not the whole
        // paper: leaving a question blank is not the same as getting it wrong.
        accuracy: percent(correct, correct + wrong),
        correct,
        wrong,
        unattempted,
        timeSeconds: Math.round(submission.totalTimeSeconds),
      },
      topper: reference.topper,
      average: reference.average,
      questions: questionResults,
    },
  };
}

export function totalMarks(attempt: ExamAttempt): number {
  return allQuestions(attempt).reduce((total, question) => total + question.marks, 0);
}

/**
 * Guards against a mis-authored paper.
 *
 * A paper whose question marks do not add up to its advertised total, or which
 * has questions without an answer key, would quietly mark everyone wrongly.
 */
export function validateQuestionBank(
  attempt: ExamAttempt,
  rubrics: QuestionRubric[],
  expectedTotal: number,
): string[] {
  const problems: string[] = [];
  const sum = totalMarks(attempt);
  if (sum !== expectedTotal) {
    problems.push(`Question marks add up to ${sum}, but the paper is out of ${expectedTotal}.`);
  }

  const covered = new Set(rubrics.map((rubric) => rubric.number));
  for (const question of allQuestions(attempt)) {
    if (!covered.has(question.number)) problems.push(`Question ${question.number} has no answer key.`);
  }
  return problems;
}

export { formatClock };
