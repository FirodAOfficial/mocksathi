/**
 * The exam attempt being sat alongside the document.
 *
 * Kept as plain data with no React or editor types, so the panels can be fed
 * from an API response later without touching the components that render them.
 */

/**
 * Whether the candidate has answered a question.
 *
 * This is *derived*, never stored: a question counts as attempted exactly when
 * its document differs from the text it started with. There is no way for the
 * badge in the palette to disagree with what is actually typed, and no button
 * that could be left out of step with the answer.
 */
export type QuestionStatus = 'attempted' | 'unattempted';

export interface ExamQuestion {
  /** 1-based, as shown to the candidate. */
  number: number;
  /** Flagged by the candidate to come back to. */
  bookmarked: boolean;
  /** The question text, shown in the list and seeded into its document. */
  prompt: string;
}

export interface ExamSection {
  name: string;
  questions: ExamQuestion[];
}

export interface ExamAttempt {
  candidateName: string;
  sections: ExamSection[];
  /** Total time allowed, in seconds. */
  durationSeconds: number;
}

/** The set of question numbers that have been edited away from their default. */
export type AnsweredSet = ReadonlySet<number>;

export const STATUS_LABEL: Record<QuestionStatus, string> = {
  attempted: 'Attempted',
  unattempted: 'Not Attempted',
};

export interface AttemptSummary {
  attempted: number;
  unattempted: number;
  markedForReview: number;
  total: number;
}

/** Every question across all sections, in order. */
export function allQuestions(attempt: ExamAttempt): ExamQuestion[] {
  return attempt.sections.flatMap((section) => section.questions);
}

/** Looks a question up by its number, across sections. */
export function findQuestion(attempt: ExamAttempt, number: number): ExamQuestion | undefined {
  return allQuestions(attempt).find((question) => question.number === number);
}

/**
 * A question is attempted once its document has been edited. Skipping a
 * question — moving past it with Next, or picking another from the list —
 * leaves it untouched, so it stays unattempted.
 */
export function statusOf(question: ExamQuestion, answered: AnsweredSet): QuestionStatus {
  return answered.has(question.number) ? 'attempted' : 'unattempted';
}

export function summarise(attempt: ExamAttempt, answered: AnsweredSet): AttemptSummary {
  const questions = allQuestions(attempt);
  const attempted = questions.filter((question) => answered.has(question.number)).length;

  return {
    attempted,
    unattempted: questions.length - attempted,
    markedForReview: questions.filter((question) => question.bookmarked).length,
    total: questions.length,
  };
}

/** `600` -> `"10:00"`. Never negative. */
export function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
