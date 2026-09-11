import type { NormalizedStyleId, ParagraphFormatting } from '@/services/document/types';
import type { MarkName } from './flatten';

/**
 * How a criterion names the text it is about.
 *
 * `range` is preferred for pure-formatting questions: offsets into the block's
 * text are unambiguous even when the same phrase appears twice, and the text
 * does not move because the question never asks the candidate to change it.
 * `text` is for questions that rewrite the passage, where offsets would shift.
 */
export type Target =
  | { by: 'range'; block: number; from: number; to: number }
  | { by: 'text'; text: string; occurrence?: number }
  | { by: 'block'; block: number }
  /** Everything in one table cell, addressed by its coordinates. */
  | { by: 'cell'; table?: number; row: number; column: number }
  | { by: 'document' };

/**
 * Formatting a question did ask for, so finding it is not a mistake.
 *
 * Everything not named here must come back exactly as it started. That is what
 * makes "make the paragraph bold" mean bold *and nothing else*: bolding and
 * italicising is two changes where one was asked for.
 */
export interface Exemption {
  target: Target;
  /** Character formatting the question asked for. */
  marks?: MarkName[];
  /** Paragraph formatting the question asked for. */
  paragraph?: (keyof ParagraphFormatting)[];
}

/** Which blocks a paragraph-level criterion applies to. */
export type BlockSelector = number | 'all';

export interface TextExpectation {
  equals?: string;
  contains?: string;
  notContains?: string;
  occurrences?: { of: string; count: number };
  /**
   * Equals the starting text put through this transformation.
   *
   * Lets a question like "change the paragraph to uppercase" be marked without
   * naming the expected text, so one rubric serves every language the passage
   * is offered in.
   */
  matchesStart?: 'upper' | 'lower' | 'capitalise' | 'toggle' | 'same';
}

/**
 * One checkable statement about a submitted document.
 *
 * `label` is written for the candidate and is shown verbatim in feedback, so it
 * should read as the thing they were asked to do — "Bold applied to *quick
 * brown*" — not as an internal assertion name.
 */
export type Criterion = { label: string } & (
  /** `value` may list alternatives, e.g. either of Word's two reds. */
  | { kind: 'marked'; target: Target; mark: MarkName; value?: string | number | (string | number)[] }
  /** Carries no formatting at all — what "remove formatting" must achieve. */
  | { kind: 'plain'; target: Target }
  /** One column repeats another, row for row. */
  | { kind: 'columnsMatch'; table?: number; from: number; to: number; skipHeader?: boolean }
  | { kind: 'notMarked'; target: Target; mark: MarkName }
  | { kind: 'blockAttr'; block: BlockSelector; attr: keyof ParagraphFormatting; value: unknown }
  | { kind: 'blockStyle'; block: BlockSelector; styleId: NormalizedStyleId }
  | { kind: 'listKind'; block: BlockSelector; listKind: 'bullet' | 'ordered' | null }
  | { kind: 'text'; block?: number; expect: TextExpectation }
  /** The text of one table cell. */
  | { kind: 'cellText'; table?: number; row: number; column: number; expect: TextExpectation }
  /** Every cell in a column carries an ordered list, i.e. Word's auto number. */
  | { kind: 'columnAutoNumbered'; table?: number; column: number; skipHeader?: boolean }
  /**
   * Nothing changed that the question did not ask for.
   *
   * This is what makes "bold X" also mean "and change nothing else": it
   * compares the submitted projection against the starting one and fails on any
   * text, character or paragraph difference the exemptions do not cover.
   */
  | { kind: 'unchanged'; except: Exemption[] }
);

/**
 * The answer key for one question. Never sent to the browser.
 *
 * Generic in its criterion type so an Excel paper's rubrics are the same shape
 * as a Word paper's — `validateQuestionBank` and the marking loop then work for
 * both without knowing what a criterion is. The default keeps every existing
 * Word rubric written as `QuestionRubric`.
 */
export interface QuestionRubric<C = Criterion> {
  number: number;
  criteria: C[];
}

export interface CriterionResult {
  label: string;
  passed: boolean;
  /** Why it failed, for feedback. Absent when it passed. */
  detail?: string;
}
