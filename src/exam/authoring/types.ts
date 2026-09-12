import type { RangeAddress } from '@/spreadsheet/model/address';
import type { CellValue } from '@/spreadsheet/model/Cell';
import type { CellStyle } from '@/spreadsheet/model/styles';
import type { WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import type { TextAlignment } from '@/services/document/types';
import type { Difficulty, Localised } from '@/exam/types';

/**
 * What a question *asks for*, as data.
 *
 * The fixtures in `seedAttempt.ts` and `excelSeedAttempt.ts` were written by
 * hand: each one states its own passage, its own model answer, and its own
 * solution steps, and the three are kept consistent by whoever edits the file.
 * That works for a fixture and not at all for a paper an admin types into a
 * form — there is no compiler there to notice that "make the paragraph bold"
 * was paired with a model answer that italicises it.
 *
 * So an authored question names the *operation*, not its consequences. One
 * `WordOperation` decides what the model answer shows and — for the answer key
 * derived server-side — what the candidate is marked against, which is what
 * stops the two from disagreeing. Everything in this file is plain JSON: it is
 * what the `test_questions` rows hold, and what the builders in `word.ts` and
 * `excel.ts` turn into the `ExamQuestion` the player renders.
 */

/** Which text a Word operation applies to. */
export type WordScope =
  /** The whole first paragraph, which is most of a paper. */
  | 'all'
  /** A character range within it — how a question names one wrapped line. */
  | { from: number; to: number };

/**
 * One thing the ribbon does, as a question can ask for it.
 *
 * Deliberately close to the buttons a candidate presses rather than to the
 * editor's internals: an admin picks "Highlight, green", and which ProseMirror
 * mark that turns into is this module's problem, not theirs.
 */
export type WordOperation =
  | { kind: 'bold' }
  | { kind: 'italic' }
  | { kind: 'underline' }
  | { kind: 'strike' }
  /** `#rrggbb`. */
  | { kind: 'highlight'; color: string }
  /** `#rrggbb`. */
  | { kind: 'fontColor'; color: string }
  | { kind: 'fontFamily'; family: string }
  /** Points, as the ribbon's size box shows. */
  | { kind: 'fontSize'; size: number }
  | { kind: 'align'; align: TextAlignment }
  /** A multiplier: 2 for Word's "2.0". */
  | { kind: 'lineHeight'; value: number }
  /** Indent levels, as Increase Indent applies them. */
  | { kind: 'indent'; levels: number };

/** Character formatting applies to the scope; paragraph formatting always applies to the block. */
export const BLOCK_LEVEL_WORD_KINDS = ['align', 'lineHeight', 'indent'] as const;

export function isBlockLevel(operation: WordOperation): boolean {
  return (BLOCK_LEVEL_WORD_KINDS as readonly string[]).includes(operation.kind);
}

/** A cell an Excel answer fills in — a total, a formula, a relabelled id. */
export interface AnswerCell {
  row: number;
  col: number;
  value?: CellValue;
  /** Present when the question asks for a formula rather than a typed value. */
  formula?: string;
}

/**
 * One thing a spreadsheet question asks for.
 *
 * `numberFormat` is not a kind of its own: it is a `CellStyle` property, so
 * "format as currency" is a `style` operation like any other.
 */
export type ExcelOperation =
  | {
      kind: 'merge';
      range: RangeAddress;
      /** Merge Across joins each row separately, rather than the range into one cell. */
      across?: boolean;
      /** Merge & Center also centres; plain Merge does not. */
      centre?: boolean;
    }
  | { kind: 'style'; range: RangeAddress; style: Partial<CellStyle> }
  /** The perimeter only — what Outside Borders does, and All Borders does not. */
  | { kind: 'outsideBorder'; range: RangeAddress; color?: string }
  | { kind: 'values'; cells: AnswerCell[] }
  /** CSS pixels. */
  | { kind: 'columnWidth'; col: number; width: number }
  | { kind: 'freeze'; rows: number; columns: number }
  | { kind: 'view'; showGridlines?: boolean; showHeadings?: boolean }
  | { kind: 'printArea'; range: RangeAddress | null };

/** Everything a question has whichever application it is sat in. */
export interface QuestionDraftBase {
  /** 1-based, as shown to the candidate. */
  number: number;
  topic: string;
  difficulty: Difficulty;
  instruction: Localised<string>;
  /** The ribbon route, step by step, shown after the paper closes. */
  solution: Localised<string[]>;
  marks: number;
}

export interface WordQuestionDraft extends QuestionDraftBase {
  subject: 'word';
  /**
   * The passage, one paragraph per line, per language.
   *
   * A character-range scope is measured against the rendered page, so a
   * question that uses one must not vary its passage by language — see the
   * note on `BOAT_LINE_TWO` in `seedAttempt.ts`.
   */
  lines: Localised<string[]>;
  scope: WordScope;
  operations: WordOperation[];
}

export interface ExcelQuestionDraft extends QuestionDraftBase {
  subject: 'excel';
  /**
   * The sheet the candidate starts from, per language.
   *
   * A built snapshot rather than the grid of strings a form produces — which
   * is the one place this type is not symmetrical with `WordQuestionDraft`,
   * and deliberately so. `excelSeedAttempt.ts` composes its sheets from typed
   * data (numbers stay numbers, ids stay ids), and routing that through
   * strings only to parse them back would put a guess in the middle of a
   * fixture that has no need of one. An authored question calls
   * `workbookFromGrid` on the way in and arrives here in the same shape.
   *
   * Only the labels may differ between languages. The numbers, the layout and
   * every cell address must not — that is what keeps one answer key correct
   * for both.
   */
  workbook: Localised<WorkbookSnapshot>;
  operations: ExcelOperation[];
}

/**
 * A question, whichever application it is sat in.
 *
 * A union rather than one interface with optional fields, for the same reason
 * `ExamQuestion` is: a Word question with a grid and an Excel question with a
 * passage are both nonsense, and the compiler should say so where they are
 * written.
 */
export type QuestionDraft = WordQuestionDraft | ExcelQuestionDraft;

export function isWordDraft(draft: QuestionDraft): draft is WordQuestionDraft {
  return draft.subject === 'word';
}

export function isExcelDraft(draft: QuestionDraft): draft is ExcelQuestionDraft {
  return draft.subject === 'excel';
}
