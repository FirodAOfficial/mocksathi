import type { Criterion, Target } from '@/exam/marking/criteria';
import type { MarkName } from '@/exam/marking/flatten';
import type { ModelAnswer } from '@/exam/types';
import type { ParagraphFormatting } from '@/services/document/types';

/**
 * One vocabulary for everything the editor can be asked to do.
 *
 * Before this file a single formatting command was spread over six places that
 * had no way of knowing about each other: the ribbon that applies it, the
 * authoring type that stores it, the model answer that shows it, the rubric
 * that marks it, the request parser that validates it, and the admin form that
 * offers it. Adding "underline, double" meant six edits and six chances to ship
 * a question that asks for one thing and marks another.
 *
 * A function declares itself once here. The ribbon applies it, the admin form
 * builds its fields from `params`, the request parser validates against the
 * same `params`, and `answer` and `criterion` are the *only* statements of what
 * the operation means — so the worked answer and the answer key are two
 * readings of one sentence rather than two sentences that have to agree.
 *
 * Nothing in this module may import the editor: it is reached from the marking
 * engine, which runs on the server (`serverSafety.test.ts` enforces that). The
 * editor half lives in `apply.ts`, which imports this and never the reverse.
 */

/** Which ribbon group a function belongs to — how the admin form groups them. */
export type FunctionCategory = 'font' | 'paragraph' | 'styles' | 'lists';

export const FUNCTION_CATEGORIES: { value: FunctionCategory; label: string }[] = [
  { value: 'font', label: 'Font' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'styles', label: 'Styles' },
  { value: 'lists', label: 'Lists' },
];

/**
 * One argument a function takes.
 *
 * Deliberately a small closed set of shapes rather than a JSON Schema: these
 * are the five kinds of control Word's dialogs actually use, and each one maps
 * to a single input in the admin form and a single validation rule on the
 * server. A sixth shape is a decision, not a convenience — see the skill.
 */
export type ParamSpec =
  /** `#rrggbb`, rendered as a colour well. */
  | { name: string; label: string; type: 'colour'; default: string }
  | {
      name: string;
      label: string;
      type: 'number';
      min: number;
      max: number;
      step?: number;
      /** Shown after the box: `pt`, `cm`, `%`. */
      unit?: string;
      default: number;
    }
  | {
      name: string;
      label: string;
      type: 'enum';
      options: readonly { value: string; label: string }[];
      default: string;
    }
  | { name: string; label: string; type: 'text'; maxLength: number; default: string; suggestions?: readonly string[] }
  | { name: string; label: string; type: 'boolean'; default: boolean };

/** The arguments a stored operation carries, beside its `kind`. */
export type FunctionArgs = Record<string, unknown>;

/**
 * What a function contributes to the document once it has been applied.
 *
 * Marks and attributes in editor JSON form, because that is what the model
 * answer is: the passage as it looks when the question has been answered.
 */
export interface AnswerContribution {
  /** Marks of their own — bold, highlight. */
  marks?: NonNullable<ModelAnswer['marks']>;
  /**
   * Attributes merged into the shared `textStyle` mark.
   *
   * Font family, size, colour and the Font dialog's advanced settings all ride
   * on one mark; two `textStyle` marks on the same run is not something the
   * editor produces, and a model answer carrying two would render only the last.
   */
  textStyle?: Record<string, unknown>;
  /** Paragraph attributes set on the block. */
  attrs?: Record<string, unknown>;
}

/** What the criterion is written about — "The paragraph", "The named line". */
export interface CriterionContext {
  target: Target;
  /** How the label should name the text under test. */
  subject: string;
  /**
   * The paragraph the selection lies in, 0-based.
   *
   * Paragraph-level criteria address a block rather than a range of
   * characters, so they need the block the selection landed in — not always
   * the first one, now that a question can name the fourth paragraph.
   */
  block: number;
}

/**
 * A function, as every part of the app needs to see it.
 *
 * `O` is the stored operation this entry describes, narrowed from the union in
 * `@/exam/authoring/types`. That narrowing is what makes the catalog total: the
 * catalog is typed as one entry per member of the union, so adding a member
 * without adding its entry does not compile.
 */
export interface DocFunction<O extends { kind: string } = { kind: string }> {
  /** Matches the operation's `kind`, and is the id the skill tells you to pick. */
  id: O['kind'];
  /** What the ribbon calls it, and what the admin form's picker shows. */
  label: string;
  category: FunctionCategory;
  /**
   * Whether it formats characters or the block.
   *
   * A question scoped to half a line still aligns the whole paragraph — Word
   * has no way to centre part of a line — so this decides whether the scope
   * reaches the operation at all.
   */
  level: 'character' | 'paragraph';
  params: ParamSpec[];
  /**
   * True when the function changes the passage's wording rather than its
   * formatting.
   *
   * A question containing one is not closed with "and nothing else changed":
   * that criterion compares the submission character by character against the
   * starting document, which is exactly what a replacement is meant to break.
   */
  rewritesText?: boolean;
  /** The passage as it looks once this has been applied. */
  answer: (operation: O) => AnswerContribution;
  /**
   * What must be true of the submission, in the candidate's words.
   *
   * A list because one function can be two statements: "underline, double, in
   * red" is a style and a colour, and a candidate who gets one right and the
   * other wrong should see which.
   */
  criteria: (operation: O, context: CriterionContext) => Criterion[];
  /**
   * The formatting this licenses, so `unchanged` does not fail the very change
   * the question asked for. Character functions name a mark; paragraph
   * functions name a `ParagraphFormatting` property; the two flags cover the
   * paragraph style and list membership, which `unchanged` checks on their own.
   */
  licences: (operation: O) => {
    marks?: MarkName[];
    paragraph?: (keyof ParagraphFormatting)[];
    style?: boolean;
    list?: boolean;
  };
  /** One line of English for a solution step or an admin summary. */
  describe: (operation: O) => string;
}

/** Builds an operation with every parameter at its default. */
export function defaultArgs(spec: DocFunction): FunctionArgs {
  const args: FunctionArgs = {};
  for (const param of spec.params) args[param.name] = param.default;
  return args;
}
