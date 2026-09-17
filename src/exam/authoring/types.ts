import type { SelectionSpec } from '@/editor/functions/selection';
import type { UnderlineStyle } from '@/editor/functions/underline';
import type { RangeAddress } from '@/spreadsheet/model/address';
import type { CellValue } from '@/spreadsheet/model/Cell';
import type { CellStyle } from '@/spreadsheet/model/styles';
import type { WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import type { NormalizedStyleId, TextAlignment } from '@/services/document/types';
import type { LengthUnit } from '@/utils/units';
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

/**
 * Which text a Word operation applies to.
 *
 * The named selectors — the third word, the second sentence, a phrase by its
 * text — live in `@/editor/functions/selection`, which is also where they are
 * resolved into character offsets. `'all'` and a bare `{ from, to }` are the
 * two shapes that existed before and still mean exactly what they did.
 */
export type WordScope = SelectionSpec;

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
  /** Word's underline drop-down: the line's style, and optionally its colour. */
  | { kind: 'underlineStyle'; style: UnderlineStyle; color?: string }
  | { kind: 'strike' }
  | { kind: 'doubleStrike' }
  | { kind: 'superscript' }
  | { kind: 'subscript' }
  /** `#rrggbb`. */
  | { kind: 'highlight'; color: string }
  /** `#rrggbb`. */
  | { kind: 'fontColor'; color: string }
  | { kind: 'fontFamily'; family: string }
  /** Points, as the ribbon's size box shows. */
  | { kind: 'fontSize'; size: number }
  /** The Font dialog's Small caps / All caps. */
  | { kind: 'caps'; caps: 'small' | 'all' }
  /** The Font dialog's Hidden. */
  | { kind: 'hidden' }
  | { kind: 'effect'; effect: 'emboss' | 'engrave' }
  /** Percentage of normal width, from the Font dialog's Advanced tab. */
  | { kind: 'charScale'; scale: number }
  /** Points: positive is Expanded, negative Condensed. */
  | { kind: 'charSpacing'; points: number }
  | { kind: 'align'; align: TextAlignment }
  /** A multiplier: 2 for Word's "2.0". */
  | { kind: 'lineHeight'; value: number }
  /** The Paragraph dialog's At least / Exactly line spacing, in points. */
  | { kind: 'lineSpacingAt'; mode: 'atLeast' | 'exactly'; points: number }
  /** Indent levels, as Increase Indent applies them. */
  | { kind: 'indent'; levels: number }
  /** The Paragraph dialog's indent boxes, in the unit the question states. */
  | { kind: 'indentLeft'; cm: number; unit?: LengthUnit }
  | { kind: 'indentRight'; cm: number; unit?: LengthUnit }
  /** The Paragraph dialog's Special: First line, or Hanging. */
  | { kind: 'firstLineIndent'; special: 'firstLine' | 'hanging'; cm: number; unit?: LengthUnit }
  /** Space before / after the paragraph, in points. */
  | { kind: 'spaceBefore'; points: number }
  | { kind: 'spaceAfter'; points: number }
  /** "Don't add space between paragraphs of the same style". */
  | { kind: 'contextualSpacing' }
  | { kind: 'border'; edge: 'top' | 'bottom' | 'left' | 'right' | 'all'; color?: string }
  /** A style from the Home tab's gallery. */
  | { kind: 'paragraphStyle'; style: NormalizedStyleId }
  | { kind: 'list'; list: 'bullet' | 'ordered' }
  /**
   * Replaces a word wherever it appears — "change 'contact' to 'conversation'".
   *
   * The one operation that changes the passage's wording rather than its
   * formatting, which is why a question using it is marked differently: see
   * `rewritesText` in the catalog.
   */
  | { kind: 'replaceText'; find: string; replacement: string }
  /** Takes a colour off — "remove the blue from the second paragraph". */
  | { kind: 'removeFontColor' }
  | { kind: 'removeHighlight' }
  | { kind: 'removeUnderline' }
  /** All formatting off, as the Clear Formatting button does. */
  | { kind: 'clearFormatting' }
  /**
   * "Highlight it in any colour, but not yellow."
   *
   * A real question and not a variant of `highlight`: what is being tested is
   * that they found the highlighter, not which swatch they landed on.
   */
  | { kind: 'highlightAny'; except?: string };

/**
 * Character formatting applies to the scope; paragraph formatting always
 * applies to the block — Word has no way to centre half a line.
 *
 * `isBlockLevel` lives in the catalog (`@/editor/functions/catalog`), where
 * each function declares its own level beside everything else it says about
 * itself, rather than being listed a second time here.
 */

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

/**
 * One selection and what is done to it.
 *
 * A question is a list of these. Most are a list of one — "centre the
 * paragraph" — but "number the first, second and fourth paragraphs" is three,
 * and "replace the word and then bold it" is a replacement and two formats on
 * the same selection. Both the worked answer and the answer key are built by
 * walking the same list, so a step that is shown is a step that is marked.
 */
export interface WordStep {
  scope: WordScope;
  operations: WordOperation[];
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
  /** The selection for a single-step question. Ignored when `steps` is given. */
  scope: WordScope;
  /** The operations for a single-step question. Ignored when `steps` is given. */
  operations: WordOperation[];
  /**
   * A question that asks for more than one thing, each with its own selection.
   *
   * Optional because most questions are one step, and writing every one of
   * those as a one-entry list would add a level of nesting to the whole paper
   * for the sake of the few that need it.
   */
  steps?: WordStep[];
  /**
   * Formatting the passage *starts* with.
   *
   * Written in the same vocabulary as everything else, because it is the same
   * thing seen from the other side: "remove the blue from the second
   * paragraph" is only a question if the second paragraph is blue to begin
   * with, and "change this list to bullets" needs a list to change. The steps
   * are applied to the passage when the question is built, so the document the
   * candidate opens and the document `unchanged` compares against are the same
   * one.
   */
  initial?: WordStep[];
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
