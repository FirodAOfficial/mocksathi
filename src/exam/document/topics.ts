import type { CharacterProperty, DocumentStep, ParagraphProperty } from './types';

/**
 * What a single-document question exercises, as a fixed list.
 *
 * A dropdown rather than free text, so "Bold", "bold" and "Bolding" are not
 * three topics in a report. Named after the ribbon groups and dialog sections a
 * candidate uses, and chosen so every property detection can read belongs to
 * exactly one — which is what lets the form pick them for the admin.
 *
 * Stored in the existing `topic` text column joined with `TOPIC_SEPARATOR`
 * rather than in a new array column: one question carries one or two, and a
 * schema change for that would cost a migration the flow does not need.
 */
export const DOCUMENT_TOPICS = [
  'Font Style',
  'Font & Size',
  'Font Colour & Highlight',
  'Font Effects',
  'Alignment',
  'Line & Paragraph Spacing',
  'Indentation',
  'Borders',
  'Styles',
  'Bullets & Numbering',
  // Never detected in the single-document flow — wording is fixed there, and
  // Clear Formatting reads as the removals it is made of — but asked for by
  // the per-question papers' operations of the same names.
  'Find & Replace',
  'Clear Formatting',
] as const;

export type DocumentTopic = (typeof DOCUMENT_TOPICS)[number];

export const TOPIC_SEPARATOR = ', ';

/**
 * The topic each detected property belongs to.
 *
 * Typed as one entry per property the model has, so a new `RunFormatting` or
 * `ParagraphFormatting` field without a topic is a compile error, not a
 * question saved with nothing ticked. Adding one: `.claude/skills/editor-functions`.
 */
const TOPIC_OF: Record<CharacterProperty | ParagraphProperty, DocumentTopic> = {
  bold: 'Font Style',
  italic: 'Font Style',
  underline: 'Font Style',
  underlineStyle: 'Font Style',
  strike: 'Font Style',
  doubleStrike: 'Font Style',
  vertAlign: 'Font Style',
  fontFamily: 'Font & Size',
  fontSize: 'Font & Size',
  color: 'Font Colour & Highlight',
  highlight: 'Font Colour & Highlight',
  underlineColor: 'Font Colour & Highlight',
  caps: 'Font Effects',
  hidden: 'Font Effects',
  effect: 'Font Effects',
  charScale: 'Font Effects',
  charSpacing: 'Font Effects',
  align: 'Alignment',
  lineHeight: 'Line & Paragraph Spacing',
  lineSpacingMode: 'Line & Paragraph Spacing',
  lineSpacingPt: 'Line & Paragraph Spacing',
  spaceBefore: 'Line & Paragraph Spacing',
  spaceAfter: 'Line & Paragraph Spacing',
  contextualSpacing: 'Line & Paragraph Spacing',
  indentLeft: 'Indentation',
  indentRight: 'Indentation',
  indentFirstLine: 'Indentation',
  borders: 'Borders',
  styleId: 'Styles',
  list: 'Bullets & Numbering',
};

export function isDocumentTopic(value: unknown): value is DocumentTopic {
  return typeof value === 'string' && (DOCUMENT_TOPICS as readonly string[]).includes(value);
}

/** Puts topics in a list's own order, without repeats or strays. */
export function orderIn<T extends string>(list: readonly T[], topics: Iterable<string>): T[] {
  const chosen = new Set<string>(topics);
  return list.filter((topic) => chosen.has(topic));
}

/** Puts topics in the Word list's own order, without repeats. */
export function orderTopics(topics: Iterable<DocumentTopic>): DocumentTopic[] {
  return orderIn(DOCUMENT_TOPICS, topics);
}

/** The topics a recorded operation exercises — what the form selects for the admin. */
export function topicsFor(steps: readonly DocumentStep[]): DocumentTopic[] {
  const found: DocumentTopic[] = [];
  for (const step of steps) {
    if (step.licenceOnly) continue;
    for (const change of step.changes) {
      const topic = TOPIC_OF[change.property as CharacterProperty | ParagraphProperty];
      if (topic) found.push(topic);
    }
  }
  return orderTopics(found);
}

export function joinTopics(topics: readonly DocumentTopic[]): string {
  return orderTopics(topics).join(TOPIC_SEPARATOR);
}

/**
 * The topics stored in a question's `topic` column.
 *
 * Anything that is not on the list is dropped: a question saved before the
 * list existed opens with nothing selected and is re-picked, rather than
 * carrying text the dropdown has no way to show.
 */
export function splitTopics(value: string): DocumentTopic[] {
  return splitTopicsIn(DOCUMENT_TOPICS, value);
}

/** `splitTopics`, against any topic list. */
export function splitTopicsIn<T extends string>(list: readonly T[], value: string): T[] {
  return orderIn(
    list,
    value.split(TOPIC_SEPARATOR).map((part) => part.trim()),
  );
}
