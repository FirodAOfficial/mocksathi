import type { JSONContent } from '@tiptap/core';
import type { ParagraphFormatting, RunFormatting } from '@/services/document/types';

/**
 * A Word paper written on one document.
 *
 * The per-question papers (`src/exam/authoring/`) give every question its own
 * passage and ask the admin to *describe* the operation in a form. This flow is
 * the other way round: the admin types one passage into the real editor and
 * then simply performs each question's operation on it, in order. What they did
 * is read off the difference between the document before and after — never
 * typed — and that difference is what the question stores and what it is
 * marked against.
 *
 * Everything here is plain JSON, kept in `word_doc_questions.steps`, and is
 * addressed by paragraph index and character offset. That is safe only because
 * the wording never changes: every question in this flow is a formatting
 * question, and detection refuses one that edits the text (`detect.ts`). With
 * the text fixed, "characters 4–9 of paragraph 2" means the same thing in every
 * order a candidate could answer the questions in.
 */

/** A character property, as the marking projection (`flatten.ts`) holds it. */
export type CharacterProperty = keyof RunFormatting;

/** A paragraph property, plus the two that are not attributes: style and list. */
export type ParagraphProperty = keyof ParagraphFormatting | 'styleId' | 'list';

export type CharacterValue = string | number | boolean | null;

export interface CharacterChange {
  property: CharacterProperty;
  /** The value afterwards. `null` means the formatting was taken off. */
  value: CharacterValue;
  /** The value before, on the first changed character — only for describing it. */
  previous: CharacterValue;
  /**
   * Exactly the characters that changed, spaces included.
   *
   * What replaying the question puts back (`apply.ts`). The step's own
   * `from`/`to` is this trimmed of surrounding spaces, which is what the
   * candidate is asked for; this is what the admin actually did.
   */
  range: { from: number; to: number };
  /**
   * The characters this change may touch without failing "nothing else changed".
   *
   * Usually the changed characters themselves. It is wider when the new value
   * runs on into characters that already had it — bolding the rest of a
   * paragraph whose first word was already bold — because a candidate who
   * answers the questions in another order selects the whole paragraph, and
   * re-bolding the first word is not a change the question forbade.
   */
  licence: { from: number; to: number };
}

export interface ParagraphChange {
  property: ParagraphProperty;
  /** The value afterwards; `null` is the default (no alignment, no list…). */
  value: unknown;
  previous: unknown;
}

/** Character formatting applied to one run of text inside one paragraph. */
export interface CharacterStep {
  level: 'character';
  /** 0-based paragraph, counted as `flatten` counts them (table cells included). */
  block: number;
  /** The characters the question is about, trimmed of surrounding spaces. */
  from: number;
  to: number;
  /** Those characters, for showing the admin what was detected. */
  text: string;
  changes: CharacterChange[];
  /**
   * True when only spaces changed.
   *
   * Licensed — a double-click selects the trailing space, and formatting it is
   * not a wrong answer — but never required, so it produces no criterion.
   */
  licenceOnly?: boolean;
}

/** Paragraph formatting applied to one or more whole paragraphs. */
export interface ParagraphStep {
  level: 'paragraph';
  /** 0-based paragraphs that received exactly these changes. */
  blocks: number[];
  changes: ParagraphChange[];
  /** True for empty paragraphs: a change nobody can see is allowed, not required. */
  licenceOnly?: boolean;
}

export type DocumentStep = CharacterStep | ParagraphStep;

/**
 * One visit to a question that changed something, as the candidate's browser
 * records it.
 *
 * The timeline is the whole sitting in order. Only the *after* document is
 * sent: the before of each entry is the after of the one preceding it, and the
 * before of the first is the paper's own passage, loaded on the server. That
 * makes the chain impossible to fake from the client — there is no "before"
 * field a candidate could fill with a document that flatters their answer.
 */
export interface TimelineEntry {
  question: number;
  document: JSONContent;
}
