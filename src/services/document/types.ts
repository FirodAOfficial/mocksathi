/**
 * The normalised document model.
 *
 * This is the single format-agnostic representation that sits between a parser
 * and the editor. Parsers (DOCX today; RTF/ODT/HTML later) produce this shape;
 * the editor adapter consumes it. Neither side knows about the other, which is
 * what makes adding a format or swapping the editor engine a local change.
 *
 * Units are normalised at the parser boundary: lengths are CSS pixels, font
 * sizes are points, colours are `#rrggbb`. Downstream code never sees twips,
 * half-points, or eighth-points.
 */

export type DocumentFormat = 'docx' | 'doc' | 'txt' | 'blank';

/** Paragraph styles exposed by the Styles gallery in the Home ribbon. */
export type NormalizedStyleId =
  | 'Normal'
  | 'NoSpacing'
  | 'Heading1'
  | 'Heading2'
  | 'Heading3'
  | 'Title'
  | 'Subtitle'
  | 'Quote';

export type TextAlignment = 'left' | 'center' | 'right' | 'justify';

export interface RunFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Word's w:vertAlign. Mutually exclusive with itself, never both. */
  vertAlign?: 'sub' | 'super';
  fontFamily?: string;
  /** Points, as shown in the ribbon's size box. */
  fontSize?: number;
  /** `#rrggbb`. */
  color?: string;
  /** `#rrggbb`. */
  highlight?: string;
}

export interface TextRun {
  text: string;
  marks: RunFormatting;
  /** A `<w:br/>`: renders as a hard break rather than a paragraph split. */
  lineBreak?: boolean;
}

/** Which edges of the paragraph draw a border, per the Paragraph group's Borders control. */
export interface ParagraphBorders {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export const NO_BORDERS: ParagraphBorders = { top: false, bottom: false, left: false, right: false };

export interface ParagraphFormatting {
  align: TextAlignment | null;
  /** CSS pixels. */
  indentLeft: number | null;
  indentRight: number | null;
  /** Negative values are hanging indents. */
  indentFirstLine: number | null;
  /** Multiplier, e.g. 1.15. */
  lineHeight: number | null;
  /** CSS pixels. */
  spaceBefore: number | null;
  spaceAfter: number | null;
  borders: ParagraphBorders | null;
}

export interface ListInfo {
  kind: 'bullet' | 'ordered';
  /** 0-based nesting depth. */
  level: number;
}

export interface ParagraphBlock {
  type: 'paragraph';
  styleId: NormalizedStyleId;
  /** Set when `styleId` is a heading, so consumers need not re-derive it. */
  headingLevel: 1 | 2 | 3 | null;
  paragraph: ParagraphFormatting;
  /** Non-null when the paragraph participates in a numbered/bulleted list. */
  list: ListInfo | null;
  runs: TextRun[];
}

/**
 * Only paragraphs today. Tables, images, and page breaks become additional
 * members of this union without disturbing existing consumers.
 */
export type DocumentBlock = ParagraphBlock;

export interface DocumentMetadata {
  title: string;
  format: DocumentFormat;
  sourceUrl: string | null;
  /**
   * Constructs the parser recognised but deliberately did not represent.
   * Surfaced in the UI so formatting loss is visible rather than silent.
   */
  unsupportedFeatures: string[];
}

export interface DocumentModel {
  metadata: DocumentMetadata;
  body: DocumentBlock[];
}

export const EMPTY_PARAGRAPH_FORMATTING: ParagraphFormatting = {
  align: null,
  indentLeft: null,
  indentRight: null,
  indentFirstLine: null,
  lineHeight: null,
  spaceBefore: null,
  spaceAfter: null,
  borders: null,
};

export function createParagraph(partial: Partial<ParagraphBlock> = {}): ParagraphBlock {
  return {
    type: 'paragraph',
    styleId: 'Normal',
    headingLevel: null,
    paragraph: { ...EMPTY_PARAGRAPH_FORMATTING },
    list: null,
    runs: [],
    ...partial,
  };
}

/** A document with a single empty paragraph — what the editor opens with. */
export function createBlankDocument(title = 'Document1'): DocumentModel {
  return {
    metadata: { title, format: 'blank', sourceUrl: null, unsupportedFeatures: [] },
    body: [createParagraph()],
  };
}

/** True when the model carries no text at all. */
export function isDocumentEmpty(model: DocumentModel): boolean {
  return model.body.every((block) => block.runs.every((run) => run.text.trim() === ''));
}
