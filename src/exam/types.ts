import type { JSONContent } from '@tiptap/core';

/** The paper is offered in one language at a time, chosen before it starts. */
export type Language = 'hi' | 'en';

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
];

export function isLanguage(value: unknown): value is Language {
  return value === 'hi' || value === 'en';
}

/** One value per language. */
export type Localised<T> = Record<Language, T>;

export function localised<T>(value: Localised<T>, language: Language): T {
  return value[language];
}

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

/**
 * How the passage looks once the question has been answered correctly.
 *
 * Held as editor formatting rather than a second copy of the passage, so the
 * model answer cannot drift out of step with the text the candidate was given.
 * It is public: the instruction already says what to apply. What counts as
 * correct is still decided server-side, against the answer key.
 */
export interface ModelAnswer {
  /**
   * Which characters of the first paragraph are formatted.
   *
   * `'all'` for the usual "format the paragraph"; a character range for the
   * questions that name one line.
   */
  scope: 'all' | { from: number; to: number };
  /** Marks applied to that text, in editor JSON form. */
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  /** Paragraph attributes set on the block. */
  attrs?: Record<string, unknown>;
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface ExamQuestion {
  /** 1-based, as shown to the candidate. */
  number: number;
  /** What the question exercises, shown on the review screen. */
  topic: string;
  difficulty: Difficulty;
  /**
   * What the candidate is asked to do — "Make the words *quick brown* bold".
   *
   * Rendered outside the editor, never inside the document. If it lived in the
   * document there would be no unambiguous region under test, and the candidate
   * could format or delete the instruction itself.
   */
  instruction: Localised<string>;
  /**
   * The document the candidate starts from and formats, per language.
   *
   * The passage differs by language, so the rubric must not depend on its
   * words: criteria address whole blocks, table cells, or text derived from
   * the passage itself, which keeps one answer key correct for both.
   */
  passage: Localised<JSONContent>;
  /**
   * How the operation is performed, step by step.
   *
   * Shown on the solutions screen after the paper closes. This is teaching
   * material, not the answer key: it describes the ribbon route, which the
   * instruction already implies, so it is safe to ship to the browser. What
   * counts as correct lives server-side in the question bank.
   */
  solution: Localised<string[]>;
  /** The passage as it looks when the question has been answered correctly. */
  modelAnswer: ModelAnswer;
  /** Marks awarded for getting the whole question right. */
  marks: number;
  /** Flagged by the candidate to come back to. */
  bookmarked: boolean;
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
