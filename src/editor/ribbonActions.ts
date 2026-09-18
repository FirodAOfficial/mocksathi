'use client';

import type { Editor } from '@tiptap/react';
import type { Mark, Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { CapsMode, TextEffect } from './extensions/CharacterFormat';
import type { UnderlineStyle } from './functions/underline';
import { DEFAULT_FONT_SIZE_PT, steppedFontSize } from './fontSizes';
import { applyCase, type LetterCase } from '@/utils/letterCase';
import type { NormalizedStyleId, ParagraphBorders, TextAlignment } from '@/services/document/types';

/**
 * Every editor mutation the ribbon can perform, in one place.
 *
 * Components call these functions instead of building command chains inline.
 * That keeps the React tree declarative, gives each action a name that matches
 * the control the user clicked, and means the command vocabulary can be tested
 * without rendering anything.
 */

// The ladder moved to its own module when the keyboard learned to step along
// it too; re-exported so the ribbon's importers do not have to care.
export {
  DEFAULT_FONT_SIZE_PT,
  FONT_SIZES,
  MAX_FONT_SIZE_PT,
  MIN_FONT_SIZE_PT,
  steppedFontSize,
} from './fontSizes';

export const FONT_FAMILIES = [
  'Calibri',
  'Cambria',
  'Arial',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Tahoma',
  'Courier New',
  'Trebuchet MS',
  'Garamond',
] as const;

export const LINE_SPACING_OPTIONS = [1, 1.15, 1.5, 2, 2.5, 3] as const;

/** Reads the size at the cursor, falling back to the document default. */
export function currentFontSize(editor: Editor): number {
  const raw: unknown = editor.getAttributes('textStyle').fontSize;
  if (typeof raw === 'string') {
    const value = Number.parseFloat(raw);
    if (Number.isFinite(value)) return value;
  }
  return DEFAULT_FONT_SIZE_PT;
}

export function setFontSize(editor: Editor, points: number): void {
  editor.chain().focus().setFontSize(`${points}pt`).run();
}

/** Moves one step along the size ladder rather than by a fixed increment. */
export function stepFontSize(editor: Editor, direction: 1 | -1): void {
  setFontSize(editor, steppedFontSize(currentFontSize(editor), direction));
}

export function setFontFamily(editor: Editor, family: string): void {
  editor.chain().focus().setFontFamily(family).run();
}

/**
 * Word's underline drop-down.
 *
 * Choosing a style underlines the selection in it; choosing None removes the
 * underline however it was drawn, which is why this is one function rather than
 * a toggle and a style setter that could disagree.
 */
export function setUnderlineStyle(editor: Editor, style: UnderlineStyle | null): void {
  const chain = editor.chain().focus();
  if (style === null) chain.unsetUnderline().run();
  else chain.setUnderlineStyle(style).run();
}

export function setUnderlineColor(editor: Editor, color: string | null): void {
  editor.chain().focus().setUnderlineColor(color).run();
}

/** The Font dialog's Small caps / All caps, and Hidden. */
export function setCaps(editor: Editor, caps: CapsMode | null): void {
  editor.chain().focus().setCaps(caps).run();
}

export function setHiddenText(editor: Editor, hidden: boolean): void {
  editor.chain().focus().setHiddenText(hidden).run();
}

export function setDoubleStrike(editor: Editor, on: boolean): void {
  editor.chain().focus().setDoubleStrike(on).run();
}

/** The Paragraph dialog's At least / Exactly line spacing. */
export function setLineSpacingAt(editor: Editor, mode: 'atLeast' | 'exactly' | null, points: number): void {
  editor.chain().focus().setLineSpacingAt(mode, points).run();
}

export function setContextualSpacing(editor: Editor, on: boolean): void {
  editor.chain().focus().setContextualSpacing(on).run();
}

export function setTextColor(editor: Editor, color: string | null): void {
  const chain = editor.chain().focus();
  if (color === null) chain.unsetColor().run();
  else chain.setColor(color).run();
}

export function setHighlightColor(editor: Editor, color: string | null): void {
  const chain = editor.chain().focus();
  if (color === null) chain.unsetHighlight().run();
  else chain.setHighlight({ color }).run();
}

export function setAlignment(editor: Editor, align: TextAlignment): void {
  editor.chain().focus().setTextAlign(align).run();
}

export function setLineSpacing(editor: Editor, multiplier: number): void {
  editor
    .chain()
    .focus()
    .setLineHeight(multiplier)
    // Word's line-spacing menu also owns paragraph space-after; matching that
    // keeps the two controls from fighting over the same visual result.
    .run();
}

export function setParagraphSpacing(editor: Editor, spacing: { before?: number | null; after?: number | null }): void {
  editor.chain().focus().setParagraphSpacing(spacing).run();
}

export function setBorders(editor: Editor, borders: ParagraphBorders | null): void {
  editor.chain().focus().setParagraphBorders(borders).run();
}

export function changeIndent(editor: Editor, direction: 1 | -1): void {
  editor.chain().focus().changeIndent(direction).run();
}

/**
 * Narrows the selection to the text inside its blocks.
 *
 * Lifting a node out of a blockquote needs a block range that does not itself
 * contain the blockquote. After Select All the selection starts at the document
 * root, so the range includes the wrapper and `lift` refuses — leaving the text
 * quoted when the user asked for a heading. Pulling the endpoints inside the
 * first and last text blocks gives `lift` a range it can act on.
 */
function narrowToBlockContent(editor: Editor): { from: number; to: number } | null {
  const { doc, selection } = editor.state;
  let from: number | null = null;
  let to: number | null = null;

  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (node.isTextblock) {
      if (from === null) from = pos + 1;
      to = pos + node.nodeSize - 1;
    }
    return true;
  });

  return from === null || to === null ? null : { from, to };
}

/**
 * Applies a gallery style.
 *
 * Styles span three different representations — heading nodes, a blockquote
 * wrapper, and named paragraphs — so switching between them has to unwind the
 * previous one first. Doing that in one chain keeps it a single undo step.
 */
export function setParagraphStyle(editor: Editor, styleId: NormalizedStyleId): void {
  const chain = editor.chain().focus();

  // Leaving a quote is a structural change and has to happen before the node
  // type is set, or the new node would stay wrapped.
  if (editor.isActive('blockquote') && styleId !== 'Quote') {
    const inner = narrowToBlockContent(editor);
    if (inner) chain.setTextSelection(inner);
    chain.unsetBlockquote();
  }

  switch (styleId) {
    case 'Heading1':
    case 'Heading2':
    case 'Heading3': {
      const level = Number(styleId.replace('Heading', '')) as 1 | 2 | 3;
      chain.setNode('heading', { level, styleName: null });
      break;
    }
    case 'Quote':
      chain.setNode('paragraph', { styleName: null });
      if (!editor.isActive('blockquote')) chain.setBlockquote();
      break;
    case 'Title':
    case 'Subtitle':
    case 'NoSpacing':
      chain.setNode('paragraph', { styleName: styleId });
      break;
    case 'Normal':
    default:
      chain.setNode('paragraph', { styleName: null });
      break;
  }

  chain.run();
}

/** The gallery style that best describes the current selection. */
export function currentParagraphStyle(editor: Editor): NormalizedStyleId {
  if (editor.isActive('blockquote')) return 'Quote';
  if (editor.isActive('heading', { level: 1 })) return 'Heading1';
  if (editor.isActive('heading', { level: 2 })) return 'Heading2';
  if (editor.isActive('heading', { level: 3 })) return 'Heading3';

  const styleName: unknown = editor.getAttributes('paragraph').styleName;
  if (styleName === 'Title' || styleName === 'Subtitle' || styleName === 'NoSpacing') return styleName;
  return 'Normal';
}

/** Clear Formatting: marks, paragraph formatting, and the block style. */
export function clearFormatting(editor: Editor): void {
  const chain = editor.chain().focus();
  if (editor.isActive('blockquote')) {
    const inner = narrowToBlockContent(editor);
    if (inner) chain.setTextSelection(inner);
    chain.unsetBlockquote();
  }
  chain.unsetAllMarks().clearBlockFormat().setNode('paragraph', { styleName: null, textAlign: null }).run();
}

/* ------------------------------------------------------------------------
 * Change Case
 * --------------------------------------------------------------------- */

/**
 * Changes the case of the selection in place.
 *
 * Each text node is rewritten with its own marks preserved, rather than the
 * selection being replaced wholesale — replacing would flatten formatting the
 * candidate had already applied, which on a formatting exam is destructive.
 * Nodes are rewritten last-first so earlier positions stay valid.
 */
export function changeCase(editor: Editor, mode: LetterCase): void {
  const { state } = editor;
  const { from, to } = state.selection;
  if (from === to) return;

  const edits: { from: number; to: number; text: string; marks: readonly Mark[] }[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return true;
    const start = Math.max(pos, from);
    const end = Math.min(pos + node.nodeSize, to);
    if (start >= end) return true;

    const slice = node.text.slice(start - pos, end - pos);
    const replaced = applyCase(slice, mode);
    if (replaced !== slice) edits.push({ from: start, to: end, text: replaced, marks: node.marks });
    return true;
  });

  if (edits.length === 0) return;

  const tr = state.tr;
  for (const edit of edits.reverse()) {
    tr.replaceWith(edit.from, edit.to, state.schema.text(edit.text, [...edit.marks]));
  }
  editor.view.dispatch(tr);
  editor.commands.focus();
}

/* ------------------------------------------------------------------------
 * Font dialog formatting
 * --------------------------------------------------------------------- */

export function setTextEffect(editor: Editor, effect: TextEffect | null): void {
  editor.chain().focus().setTextEffect(effect).run();
}

export function setCharacterScale(editor: Editor, scale: number | null): void {
  editor.chain().focus().setCharacterScale(scale).run();
}

export function setCharacterSpacing(editor: Editor, points: number | null): void {
  editor.chain().focus().setCharacterSpacing(points).run();
}

/* ------------------------------------------------------------------------
 * Tables
 * --------------------------------------------------------------------- */

export function insertTable(editor: Editor, rows: number, cols: number): void {
  editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
}

/**
 * Word's "auto number" over a table column: every body cell in the column
 * becomes a single-item numbered list, so the numbers renumber themselves.
 */
export function autoNumberColumn(editor: Editor): void {
  editor.chain().focus().toggleOrderedList().run();
}

export function toggleBulletList(editor: Editor): void {
  editor.chain().focus().toggleBulletList().run();
}

export function toggleOrderedList(editor: Editor): void {
  editor.chain().focus().toggleOrderedList().run();
}

/**
 * Word's Increase/Decrease List Level.
 *
 * Nesting a list item is formatting, so it comes from the ribbon rather than
 * from Tab — which is why `ribbonOnly` strips the list extension's Tab binding.
 * These are the buttons that put the operation back.
 */
export function changeListLevel(editor: Editor, direction: 1 | -1): void {
  const chain = editor.chain().focus();
  if (direction === 1) chain.sinkListItem('listItem').run();
  else chain.liftListItem('listItem').run();
}

/**
 * Word's Sort, ascending by the paragraph's own text.
 *
 * It reorders whole top-level blocks that the selection touches and moves each
 * node as it stands, so every paragraph keeps the formatting it arrived with.
 */
export function sortParagraphs(editor: Editor, direction: 1 | -1 = 1): void {
  const { state } = editor;
  const { from, to } = state.selection;

  const picked: { node: ProseMirrorNode; start: number; end: number }[] = [];
  state.doc.forEach((node, offset) => {
    const end = offset + node.nodeSize;
    if (end > from && offset < to && node.isTextblock) picked.push({ node, start: offset, end });
  });

  if (picked.length < 2) return;

  const sorted = [...picked].sort(
    (a, b) => direction * a.node.textContent.localeCompare(b.node.textContent),
  );

  const first = picked[0]!.start;
  const last = picked[picked.length - 1]!.end;

  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.replaceWith(
        first,
        last,
        sorted.map((entry) => entry.node),
      );
      return true;
    })
    .run();
}

/**
 * Applies a font to the whole document, as Design's Fonts gallery does.
 *
 * Word's themes change the document's default font rather than marking every
 * run. This editor has no theme layer, so the equivalent honest action is to
 * apply the font across the document and say so.
 */
export function setDocumentFont(editor: Editor, family: string): void {
  const { from, to } = editor.state.selection;
  editor.chain().focus().selectAll().setFontFamily(family).setTextSelection({ from, to }).run();
}

/** Sets the indents directly, as Layout's Indent boxes and the dialog do. */
export function setIndents(
  editor: Editor,
  indents: { left?: number | null; right?: number | null; firstLine?: number | null },
): void {
  editor.chain().focus().setParagraphIndents(indents).run();
}
