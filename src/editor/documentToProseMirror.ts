import type { JSONContent } from '@tiptap/core';
import type { DocumentBlock, DocumentModel, ParagraphBlock, RunFormatting, TextRun } from '@/services/document/types';

/** ProseMirror requires a mark's `type`, unlike the looser `JSONContent`. */
type MarkJson = NonNullable<JSONContent['marks']>[number];

/**
 * Normalised model -> ProseMirror document JSON.
 *
 * This is the only module that knows both vocabularies. Keeping the translation
 * here means the parsers never emit editor-shaped data and the editor never
 * learns what a `w:pPr` is, so either side can be replaced independently.
 */
export function documentToProseMirror(model: DocumentModel): JSONContent {
  const content = buildBlocks(model.body);
  return {
    type: 'doc',
    // ProseMirror rejects an empty doc; a blank paragraph is the valid equivalent.
    content: content.length > 0 ? content : [emptyParagraph()],
  };
}

function emptyParagraph(): JSONContent {
  return { type: 'paragraph', content: [] };
}

/** A list currently being accumulated, one entry per nesting depth. */
interface OpenList {
  kind: 'bullet' | 'ordered';
  items: JSONContent[];
}

/**
 * Word stores list membership per paragraph; ProseMirror needs nested list
 * nodes. This walks the flat sequence and rebuilds the tree, opening and
 * closing lists as the level and marker kind change.
 */
function buildBlocks(blocks: DocumentBlock[]): JSONContent[] {
  const output: JSONContent[] = [];
  const stack: OpenList[] = [];

  const closeTop = (): void => {
    const finished = stack.pop();
    if (!finished) return;

    const node: JSONContent = {
      type: finished.kind === 'bullet' ? 'bulletList' : 'orderedList',
      content: finished.items.length > 0 ? finished.items : [{ type: 'listItem', content: [emptyParagraph()] }],
    };

    const parent = stack[stack.length - 1];
    if (!parent) {
      output.push(node);
      return;
    }
    // A nested list belongs inside the parent's most recent item.
    const host = parent.items[parent.items.length - 1];
    if (host) host.content = [...(host.content ?? []), node];
    else parent.items.push({ type: 'listItem', content: [emptyParagraph(), node] });
  };

  for (const block of blocks) {
    if (!block.list) {
      while (stack.length > 0) closeTop();
      output.push(blockToNode(block));
      continue;
    }

    const depth = block.list.level + 1;

    while (stack.length > depth) closeTop();
    // A marker change at the same depth ends one list and starts another,
    // matching how Word renders a bulleted run followed by a numbered run.
    if (stack.length === depth && stack[stack.length - 1]?.kind !== block.list.kind) closeTop();
    while (stack.length < depth) stack.push({ kind: block.list.kind, items: [] });

    const current = stack[stack.length - 1];
    current?.items.push({ type: 'listItem', content: [paragraphNode(block)] });
  }

  while (stack.length > 0) closeTop();
  return output;
}

function blockToNode(block: ParagraphBlock): JSONContent {
  if (block.styleId === 'Quote') {
    return { type: 'blockquote', content: [paragraphNode(block)] };
  }
  if (block.headingLevel !== null) {
    return {
      type: 'heading',
      attrs: { level: block.headingLevel, ...blockAttributes(block) },
      content: runsToContent(block.runs),
    };
  }
  return paragraphNode(block);
}

function paragraphNode(block: ParagraphBlock): JSONContent {
  return {
    type: 'paragraph',
    attrs: blockAttributes(block),
    content: runsToContent(block.runs),
  };
}

/** Gallery styles that are paragraphs distinguished only by appearance. */
const NAMED_PARAGRAPH_STYLES = new Set(['Title', 'Subtitle', 'NoSpacing']);

function blockAttributes(block: ParagraphBlock): Record<string, unknown> {
  const { paragraph } = block;
  return {
    styleName: NAMED_PARAGRAPH_STYLES.has(block.styleId) ? block.styleId : null,
    textAlign: paragraph.align,
    lineHeight: paragraph.lineHeight,
    indentLeft: paragraph.indentLeft,
    indentRight: paragraph.indentRight,
    indentFirstLine: paragraph.indentFirstLine,
    spaceBefore: paragraph.spaceBefore,
    spaceAfter: paragraph.spaceAfter,
    borders: paragraph.borders,
  };
}

function runsToContent(runs: TextRun[]): JSONContent[] {
  const content: JSONContent[] = [];

  for (const run of runs) {
    if (run.lineBreak) {
      content.push({ type: 'hardBreak' });
      continue;
    }
    // ProseMirror text nodes cannot be empty, and an empty run carries nothing.
    if (run.text === '') continue;

    const marks = marksFor(run.marks);
    content.push({ type: 'text', text: run.text, ...(marks.length > 0 ? { marks } : {}) });
  }

  return content;
}

function marksFor(formatting: RunFormatting): MarkJson[] {
  const marks: MarkJson[] = [];

  if (formatting.bold) marks.push({ type: 'bold' });
  if (formatting.italic) marks.push({ type: 'italic' });
  if (formatting.underline) marks.push({ type: 'underline' });
  if (formatting.strike) marks.push({ type: 'strike' });
  if (formatting.vertAlign === 'sub') marks.push({ type: 'subscript' });
  if (formatting.vertAlign === 'super') marks.push({ type: 'superscript' });

  // Font family, size and colour share one mark, so they are gathered together
  // rather than pushed individually — three textStyle marks would not merge.
  const textStyle: Record<string, string> = {};
  if (formatting.fontFamily) textStyle.fontFamily = formatting.fontFamily;
  if (formatting.fontSize) textStyle.fontSize = `${formatting.fontSize}pt`;
  if (formatting.color) textStyle.color = formatting.color;
  if (Object.keys(textStyle).length > 0) marks.push({ type: 'textStyle', attrs: textStyle });

  if (formatting.highlight) marks.push({ type: 'highlight', attrs: { color: formatting.highlight } });

  return marks;
}
