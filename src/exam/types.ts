import type { JSONContent } from '@tiptap/core';
import type { RangeAddress } from '@/spreadsheet/model/address';
import type { CellValue } from '@/spreadsheet/model/Cell';
import type { WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import type { CellStyle } from '@/spreadsheet/model/styles';
import type { ColumnProps, FrozenPanes, SheetView } from '@/spreadsheet/model/Worksheet';

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

/**
 * How the workbook looks once the question has been answered correctly.
 *
 * A patch applied to the starting workbook, never a second copy of it — the
 * same choice `ModelAnswer` makes and for the same reason: a stored copy would
 * drift from the data the candidate was actually given, and the review screen
 * would then show a worked answer to a different question.
 *
 * Public, like `ModelAnswer`. The instruction already says what to do; what
 * counts as correct is still decided server-side against the answer key.
 */
export interface WorkbookAnswer {
  /** Cells the answer fills in — a total, a formula, a label. */
  cells?: Array<{ row: number; col: number; value?: CellValue; formula?: string }>;
  /** Formatting the answer applies, per range. */
  styles?: Array<{ range: RangeAddress; style: Partial<CellStyle> }>;
  merges?: RangeAddress[];
  columns?: Array<[number, ColumnProps]>;
  frozen?: FrozenPanes;
  /** Gridlines and headings, which Excel stores per sheet. */
  view?: Partial<SheetView>;
  printArea?: RangeAddress | null;
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

/**
 * Which application a paper is sat in.
 *
 * A paper is all one or all the other — the candidate sits a Word practical or
 * an Excel practical, never a mixture — so this lives on the attempt as well as
 * on each question, and the screens branch once rather than per question.
 */
export type Subject = 'word' | 'excel';

/** Everything a question has regardless of which application it is sat in. */
interface BaseQuestion {
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
   * How the operation is performed, step by step.
   *
   * Shown on the solutions screen after the paper closes. This is teaching
   * material, not the answer key: it describes the ribbon route, which the
   * instruction already implies, so it is safe to ship to the browser. What
   * counts as correct lives server-side in the question bank.
   */
  solution: Localised<string[]>;
  /** Marks awarded for getting the whole question right. */
  marks: number;
  /** Flagged by the candidate to come back to. */
  bookmarked: boolean;
}

export interface WordQuestion extends BaseQuestion {
  subject: 'word';
  /**
   * The document the candidate starts from and formats, per language.
   *
   * The passage differs by language, so the rubric must not depend on its
   * words: criteria address whole blocks, table cells, or text derived from
   * the passage itself, which keeps one answer key correct for both.
   */
  passage: Localised<JSONContent>;
  /** The passage as it looks when the question has been answered correctly. */
  modelAnswer: ModelAnswer;
}

export interface ExcelQuestion extends BaseQuestion {
  subject: 'excel';
  /**
   * The workbook the candidate starts from, per language.
   *
   * Only the labels differ between languages; the numbers, the layout and the
   * addresses do not — which is what keeps one answer key correct for both, the
   * same property the Word passages have.
   */
  workbook: Localised<WorkbookSnapshot>;
  /** The workbook as it looks when the question has been answered correctly. */
  modelAnswer: WorkbookAnswer;
}

/**
 * A question, whichever application it is sat in.
 *
 * A union rather than one interface with optional fields: a Word question with
 * no passage and an Excel question with no workbook are both nonsense, and the
 * compiler should say so at the point they are written.
 */
export type ExamQuestion = WordQuestion | ExcelQuestion;

export function isWordQuestion(question: ExamQuestion): question is WordQuestion {
  return question.subject === 'word';
}

export function isExcelQuestion(question: ExamQuestion): question is ExcelQuestion {
  return question.subject === 'excel';
}

export interface ExamSection {
  name: string;
  questions: ExamQuestion[];
}

export interface ExamAttempt {
  candidateName: string;
  subject: Subject;
  sections: ExamSection[];
  /** Total time allowed, in seconds. */
  durationSeconds: number;
}

/**
 * What a candidate submits for one question.
 *
 * A Word answer is the document they ended up with; an Excel answer is the
 * workbook they ended up with. Both are plain JSON, and neither is inspected
 * by anything between the editor and the marker — the store, the palette and
 * the transport all treat an answer as opaque.
 */
export type AnswerPayload = JSONContent | WorkbookSnapshot;

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
