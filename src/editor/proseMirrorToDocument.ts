import type { JSONContent } from '@tiptap/core';
import type {
  DocumentBlock,
  DocumentMetadata,
  DocumentModel,
  ListInfo,
  NormalizedStyleId,
  ParagraphFormatting,
  RunFormatting,
  TextRun,
} from '@/services/document/types';
import { EMPTY_PARAGRAPH_FORMATTING } from '@/services/document/types';

/**
 * ProseMirror document JSON -> normalised model.
 *
 * The inverse of `documentToProseMirror`. It exists so the editor's state can
 * be read back in the application's own vocabulary — for word counts, for
 * asserting round-trip fidelity in tests, and as the input a future .docx
 * writer would consume without needing to understand ProseMirror.
 */
export function proseMirrorToDocument(doc: JSONContent, metadata: DocumentMetadata): DocumentModel {
  return { metadata, body: readBlocks(doc.content ?? [], null) };
}

function readBlocks(nodes: JSONContent[], list: ListInfo | null): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        blocks.push(makeBlock(node, styleFromAttrs(node), null, list));
        break;
      case 'heading': {
        const level = clampHeadingLevel(node.attrs?.level);
        blocks.push(makeBlock(node, `Heading${level}` as NormalizedStyleId, level, list));
        break;
      }
      case 'blockquote':
        // The quote style lives on the wrapper, but the model keeps style on
        // the paragraph, so it is pushed down onto each child.
        for (const child of node.content ?? []) {
          blocks.push(makeBlock(child, 'Quote', null, list));
        }
        break;
      case 'bulletList':
      case 'orderedList': {
        const kind = node.type === 'bulletList' ? 'bullet' : 'ordered';
        const level = list ? list.level + 1 : 0;
        for (const item of node.content ?? []) {
          blocks.push(...readBlocks(item.content ?? [], { kind, level }));
        }
        break;
      }
      default:
        break;
    }
  }

  return blocks;
}

function clampHeadingLevel(value: unknown): 1 | 2 | 3 {
  const level = typeof value === 'number' ? value : 1;
  return level === 2 ? 2 : level === 3 ? 3 : 1;
}

function styleFromAttrs(node: JSONContent): NormalizedStyleId {
  const name = node.attrs?.styleName;
  if (name === 'Title' || name === 'Subtitle' || name === 'NoSpacing') return name;
  return 'Normal';
}

function makeBlock(
  node: JSONContent,
  styleId: NormalizedStyleId,
  headingLevel: 1 | 2 | 3 | null,
  list: ListInfo | null,
): DocumentBlock {
  return {
    type: 'paragraph',
    styleId,
    headingLevel,
    paragraph: readParagraphFormatting(node.attrs ?? {}),
    list,
    runs: readRuns(node.content ?? []),
  };
}

function readParagraphFormatting(attrs: Record<string, unknown>): ParagraphFormatting {
  const number = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

  return {
    ...EMPTY_PARAGRAPH_FORMATTING,
    align: (attrs.textAlign as ParagraphFormatting['align']) ?? null,
    lineHeight: number(attrs.lineHeight),
    indentLeft: number(attrs.indentLeft),
    indentRight: number(attrs.indentRight),
    indentFirstLine: number(attrs.indentFirstLine),
    spaceBefore: number(attrs.spaceBefore),
    spaceAfter: number(attrs.spaceAfter),
    borders: (attrs.borders as ParagraphFormatting['borders']) ?? null,
  };
}

function readRuns(nodes: JSONContent[]): TextRun[] {
  const runs: TextRun[] = [];

  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      runs.push({ text: '', marks: {}, lineBreak: true });
      continue;
    }
    if (node.type !== 'text' || typeof node.text !== 'string') continue;
    runs.push({ text: node.text, marks: readMarks(node.marks ?? []) });
  }

  return runs;
}

function readMarks(marks: NonNullable<JSONContent['marks']>): RunFormatting {
  const formatting: RunFormatting = {};

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        formatting.bold = true;
        break;
      case 'italic':
        formatting.italic = true;
        break;
      case 'underline':
        formatting.underline = true;
        break;
      case 'strike':
        formatting.strike = true;
        break;
      case 'subscript':
        formatting.vertAlign = 'sub';
        break;
      case 'superscript':
        formatting.vertAlign = 'super';
        break;
      case 'textStyle': {
        const attrs = mark.attrs ?? {};
        if (typeof attrs.fontFamily === 'string') formatting.fontFamily = attrs.fontFamily;
        if (typeof attrs.color === 'string') formatting.color = attrs.color;
        if (typeof attrs.fontSize === 'string') {
          // Sizes are written as `12pt`; strip the unit to get back to a number.
          const size = Number.parseFloat(attrs.fontSize);
          if (Number.isFinite(size)) formatting.fontSize = size;
        }
        break;
      }
      case 'highlight': {
        const color = mark.attrs?.color;
        if (typeof color === 'string') formatting.highlight = color;
        break;
      }
      default:
        break;
    }
  }

  return formatting;
}
