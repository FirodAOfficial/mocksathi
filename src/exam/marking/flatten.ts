import type {
  DocumentModel,
  ListInfo,
  NormalizedStyleId,
  ParagraphBlock,
  ParagraphFormatting,
  RunFormatting,
} from '@/services/document/types';
import { isParagraph } from '@/services/document/types';

/**
 * The canonical projection every marking decision is made against.
 *
 * A document is flattened to one entry per character, each carrying its fully
 * resolved formatting. This is what makes marking reliable: the same visible
 * result has many valid ProseMirror representations — text nodes split at
 * arbitrary points, marks in different array orders, a `textStyle` mark holding
 * only nulls, a trailing space inside or outside a bold run — and comparing
 * documents trips on all of them. None of those differences survive the
 * projection, so a criterion can ask a direct question and get a direct answer.
 */

export interface FlatChar {
  char: string;
  /** Canonical formatting: only genuinely-set properties are present. */
  marks: RunFormatting;
  /** Index of the block this character belongs to. */
  block: number;
  /** Offset of this character within its own block's text. */
  offset: number;
}

/** Where a block sits inside a table, when it does. */
export interface TableAddress {
  table: number;
  row: number;
  column: number;
}

export interface FlatBlock {
  index: number;
  styleId: NormalizedStyleId;
  headingLevel: 1 | 2 | 3 | null;
  paragraph: ParagraphFormatting;
  list: ListInfo | null;
  text: string;
  /** Index into `FlatDocument.chars` where this block starts. */
  start: number;
  /** Exclusive end index into `FlatDocument.chars`. */
  end: number;
  /**
   * Set when this paragraph lives in a table cell.
   *
   * Tables are flattened into the same linear block list rather than given a
   * nested projection: a criterion then addresses a cell by coordinates while
   * every other check works exactly as it does outside a table.
   */
  table: TableAddress | null;
}

export interface FlatDocument {
  chars: FlatChar[];
  blocks: FlatBlock[];
  /** Every block's text, joined with newlines. */
  text: string;
}

/** The formatting properties a criterion can assert on. */
export type MarkName =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'superscript'
  | 'subscript'
  | 'fontFamily'
  | 'fontSize'
  | 'color'
  | 'highlight'
  | 'emboss'
  | 'engrave'
  | 'charScale'
  | 'charSpacing';

/**
 * Reduces run formatting to a comparable form.
 *
 * `bold: false` and an absent `bold` mean the same thing and must compare
 * equal; colours are matched case-insensitively because `#FFFF00` from a
 * pasted document and `#ffff00` from the palette are the same yellow.
 */
export function canonicalMarks(marks: RunFormatting): RunFormatting {
  const canonical: RunFormatting = {};

  if (marks.bold) canonical.bold = true;
  if (marks.italic) canonical.italic = true;
  if (marks.underline) canonical.underline = true;
  if (marks.strike) canonical.strike = true;
  if (marks.vertAlign === 'sub' || marks.vertAlign === 'super') canonical.vertAlign = marks.vertAlign;

  if (marks.fontFamily) canonical.fontFamily = marks.fontFamily.trim();
  if (typeof marks.fontSize === 'number' && Number.isFinite(marks.fontSize)) {
    canonical.fontSize = marks.fontSize;
  }
  if (marks.color) canonical.color = marks.color.toLowerCase();
  if (marks.highlight) canonical.highlight = marks.highlight.toLowerCase();

  if (marks.effect === 'emboss' || marks.effect === 'engrave') canonical.effect = marks.effect;
  // 100% scale and zero spacing are the defaults, so they are not formatting.
  if (typeof marks.charScale === 'number' && Number.isFinite(marks.charScale) && marks.charScale !== 100) {
    canonical.charScale = marks.charScale;
  }
  if (typeof marks.charSpacing === 'number' && Number.isFinite(marks.charSpacing) && marks.charSpacing !== 0) {
    canonical.charSpacing = marks.charSpacing;
  }

  return canonical;
}

/** True when a character carries the named formatting (optionally a value). */
export function hasMark(
  marks: RunFormatting,
  name: MarkName,
  value?: string | number | (string | number)[],
): boolean {
  // A list of alternatives passes if any one of them matches.
  if (Array.isArray(value)) return value.some((option) => hasMark(marks, name, option));

  switch (name) {
    case 'bold':
      return marks.bold === true;
    case 'italic':
      return marks.italic === true;
    case 'underline':
      return marks.underline === true;
    case 'strike':
      return marks.strike === true;
    case 'superscript':
      return marks.vertAlign === 'super';
    case 'subscript':
      return marks.vertAlign === 'sub';
    case 'fontFamily':
      return value === undefined ? marks.fontFamily !== undefined : marks.fontFamily === value;
    case 'fontSize':
      return value === undefined ? marks.fontSize !== undefined : marks.fontSize === value;
    case 'color':
      return value === undefined
        ? marks.color !== undefined
        : marks.color === String(value).toLowerCase();
    case 'highlight':
      return value === undefined
        ? marks.highlight !== undefined
        : marks.highlight === String(value).toLowerCase();
    case 'emboss':
      return marks.effect === 'emboss';
    case 'engrave':
      return marks.effect === 'engrave';
    case 'charScale':
      return value === undefined ? marks.charScale !== undefined : marks.charScale === Number(value);
    case 'charSpacing':
      return value === undefined ? marks.charSpacing !== undefined : marks.charSpacing === Number(value);
    default:
      return false;
  }
}

/** True when a character carries no formatting whatsoever. */
export function isPlain(marks: RunFormatting): boolean {
  return Object.keys(canonicalMarks(marks)).length === 0;
}

export function marksEqual(a: RunFormatting, b: RunFormatting): boolean {
  const left = canonicalMarks(a);
  const right = canonicalMarks(b);
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

  for (const key of keys) {
    if (left[key as keyof RunFormatting] !== right[key as keyof RunFormatting]) return false;
  }
  return true;
}

/**
 * Text normalisation for comparisons.
 *
 * Candidates type; typing produces stray whitespace and, on some keyboards,
 * non-breaking spaces and decomposed accents. None of those should be the
 * difference between a right and a wrong answer.
 */
export function normaliseText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Projects a normalised document into the per-character form. */
export function flatten(model: DocumentModel): FlatDocument {
  const chars: FlatChar[] = [];
  const blocks: FlatBlock[] = [];

  const addParagraph = (paragraph: ParagraphBlock, table: TableAddress | null): void => {
    const index = blocks.length;
    const start = chars.length;
    let offset = 0;

    for (const run of paragraph.runs) {
      // A hard break reads as a newline within the block, so a criterion
      // targeting text either side of it still lines up with what is on screen.
      const text = run.lineBreak ? '\n' : run.text;
      const marks = canonicalMarks(run.marks);

      for (const char of text) {
        chars.push({ char, marks, block: index, offset });
        offset += 1;
      }
    }

    blocks.push({
      index,
      styleId: paragraph.styleId,
      headingLevel: paragraph.headingLevel,
      paragraph: paragraph.paragraph,
      list: paragraph.list,
      text: chars.slice(start).map((entry) => entry.char).join(''),
      start,
      end: chars.length,
      table,
    });
  };

  let tableIndex = 0;
  for (const block of model.body) {
    if (isParagraph(block)) {
      addParagraph(block, null);
      continue;
    }

    const table = tableIndex;
    tableIndex += 1;
    block.rows.forEach((row, rowIndex) => {
      row.cells.forEach((cell, columnIndex) => {
        for (const paragraph of cell.blocks) {
          addParagraph(paragraph, { table, row: rowIndex, column: columnIndex });
        }
      });
    });
  }

  return { chars, blocks, text: blocks.map((block) => block.text).join('\n') };
}
