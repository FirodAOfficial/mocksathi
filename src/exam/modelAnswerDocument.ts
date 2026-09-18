import type { JSONContent } from '@tiptap/core';
import { resolveSelections } from '@/editor/functions/selection';
import type { Language, ModelAnswer, WordQuestion } from './types';

/**
 * The passage as it looks once the question is answered correctly.
 *
 * Built by applying the model answer to the passage the candidate started
 * from, rather than by storing a second copy of the text: the worked answer
 * then cannot show different words from the question.
 *
 * Its own module rather than a corner of `seedAttempt.ts`, because it now
 * renders answers for authored papers too, and builds the passages that *start*
 * formatted — a question can only ask for a highlight to be removed if the
 * paragraph arrives highlighted.
 *
 * ## Slots
 *
 * A paragraph is not always a paragraph node. A bulleted one is a `bulletList`
 * wrapping a `listItem` wrapping the paragraph, and a quoted one sits in a
 * `blockquote` — and a question can put a paragraph into a list or take it out
 * again, so the wrapper is not fixed. Everything here therefore works on a
 * *slot*: the paragraph itself, plus what it is wrapped in. That keeps the
 * numbering honest — the fourth paragraph is the fourth slot, bulleted or not —
 * and stops "make it a bulleted list" from nesting a new list around the old
 * one, which is what a naive wrap does to a paragraph that is already numbered.
 */

/** Gallery styles that are paragraphs distinguished only by their appearance. */
const NAMED_PARAGRAPH_STYLES = new Set(['Title', 'Subtitle', 'NoSpacing']);

type Wrapper = 'bullet' | 'ordered' | 'quote' | null;

interface Slot {
  /** The paragraph or heading node itself. */
  node: JSONContent;
  wrapper: Wrapper;
}

/** Every part of an answer: the answer proper, then anything in `more`. */
function parts(answer: ModelAnswer): Omit<ModelAnswer, 'more'>[] {
  return [{ scope: answer.scope, marks: answer.marks, attrs: answer.attrs }, ...(answer.more ?? [])];
}

/** The plain text of a passage paragraph. */
function textOf(node: JSONContent): string {
  return (node.content ?? []).map((child) => child.text ?? '').join('');
}

/** A document's blocks as slots, unwrapping lists and quotes. */
function toSlots(content: readonly JSONContent[]): Slot[] {
  const slots: Slot[] = [];

  for (const node of content) {
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const wrapper: Wrapper = node.type === 'bulletList' ? 'bullet' : 'ordered';
      for (const item of node.content ?? []) {
        for (const child of item.content ?? []) slots.push({ node: child, wrapper });
      }
      continue;
    }

    if (node.type === 'blockquote') {
      for (const child of node.content ?? []) slots.push({ node: child, wrapper: 'quote' });
      continue;
    }

    slots.push({ node, wrapper: null });
  }

  return slots;
}

/**
 * Slots back into document nodes.
 *
 * Consecutive slots in the same kind of list join one list node, which is what
 * the editor produces when three paragraphs in a row are numbered — and what
 * the marking projection reads back as three blocks at the same list level.
 */
function fromSlots(slots: readonly Slot[]): JSONContent[] {
  const content: JSONContent[] = [];

  for (const slot of slots) {
    if (slot.wrapper === null) {
      content.push(slot.node);
      continue;
    }

    if (slot.wrapper === 'quote') {
      content.push({ type: 'blockquote', content: [slot.node] });
      continue;
    }

    const type = slot.wrapper === 'bullet' ? 'bulletList' : 'orderedList';
    const previous = content[content.length - 1];
    const item: JSONContent = { type: 'listItem', content: [slot.node] };

    if (previous?.type === type) previous.content = [...(previous.content ?? []), item];
    else content.push({ type, content: [item] });
  }

  return content;
}

/**
 * One paragraph with a part's formatting applied.
 *
 * The marks go on the selected characters only; the paragraph attributes go on
 * the block, whatever the selection was — Word has no way to centre half a
 * line, which is the same split the answer key makes.
 */
function formatted(
  node: JSONContent,
  part: Omit<ModelAnswer, 'more'>,
  ranges: readonly { from: number; to: number }[],
): JSONContent {
  const text = textOf(node);
  const { marks } = part;

  const run = (value: string, marked: boolean): JSONContent => ({
    type: 'text',
    text: value,
    ...(marked && marks && marks.length > 0 ? { marks } : {}),
  });

  // Several ranges when the question says "wherever it appears"; the runs are
  // laid down in order so the unformatted text between them survives.
  const ordered = [...ranges].sort((a, b) => a.from - b.from);
  const content: JSONContent[] = [];
  let cursor = 0;

  for (const range of ordered) {
    if (range.from > cursor) content.push(run(text.slice(cursor, range.from), false));
    content.push(run(text.slice(range.from, range.to), true));
    cursor = range.to;
  }
  content.push(run(text.slice(cursor), false));

  const attrs = { ...(node.attrs ?? {}), ...(part.attrs ?? {}) };
  // Instructions to this renderer rather than attributes the editor knows:
  // `styleId` and `list` are consumed by `restyled`, the replacement pair by
  // `rewritten`.
  delete attrs.styleId;
  delete attrs.list;
  delete attrs.replaceFind;
  delete attrs.replaceWith;

  return { ...node, attrs, content: content.filter((child) => child.text !== '') };
}

/**
 * The slot a style or a list operation turns this one into.
 *
 * A style is one of three different representations — a heading node, a quote
 * wrapper, or a named paragraph — which is the same split `setParagraphStyle`
 * makes in the editor. A list changes the wrapper rather than adding one, so a
 * numbered paragraph asked to become bulleted ends up bulleted, not both.
 */
function restyled(slot: Slot, part: Omit<ModelAnswer, 'more'>): Slot {
  const styleId = part.attrs?.styleId;
  const list = part.attrs?.list;

  let node = slot.node;
  let wrapper = slot.wrapper;

  if (typeof styleId === 'string') {
    if (styleId.startsWith('Heading')) {
      const level = Number(styleId.replace('Heading', ''));
      node = { ...node, type: 'heading', attrs: { ...(node.attrs ?? {}), level, styleName: null } };
      wrapper = wrapper === 'quote' ? null : wrapper;
    } else if (styleId === 'Quote') {
      node = { ...node, type: 'paragraph', attrs: { ...(node.attrs ?? {}), styleName: null } };
      wrapper = 'quote';
    } else {
      node = {
        ...node,
        type: 'paragraph',
        attrs: {
          ...(node.attrs ?? {}),
          styleName: NAMED_PARAGRAPH_STYLES.has(styleId) ? styleId : null,
        },
      };
      wrapper = wrapper === 'quote' ? null : wrapper;
    }
  }

  if (list === 'bullet' || list === 'ordered') wrapper = list;

  return { node, wrapper };
}

/**
 * The passage with a word replaced throughout.
 *
 * Applied to every paragraph before the step's formatting is worked out, so a
 * later step that selects the *new* word finds it — which is the order the
 * candidate works in, and the order the answer key reads.
 */
function rewritten(node: JSONContent, find: string, replacement: string): JSONContent {
  const text = textOf(node);
  if (find === '' || !text.includes(find)) return node;

  return { ...node, content: [{ type: 'text', text: text.replaceAll(find, replacement) }] };
}

/**
 * A document with a list of (selection, formatting) parts applied.
 *
 * Shared by two callers that are the same operation read in two directions:
 * the worked answer, which applies what the question asked for, and
 * `buildWordQuestion`, which applies the formatting a passage *starts* with so
 * that a question can ask for it to be taken off again.
 */
export function applyParts(document: JSONContent, list: readonly Omit<ModelAnswer, 'more'>[]): JSONContent {
  let slots = toSlots(document.content ?? []);

  for (const part of list) {
    const find = part.attrs?.replaceFind;
    const replacement = part.attrs?.replaceWith;
    if (typeof find === 'string' && typeof replacement === 'string') {
      slots = slots.map((slot) => ({ ...slot, node: rewritten(slot.node, find, replacement) }));
      continue;
    }

    // Recomputed per part: an earlier step may have rewritten the text this
    // one selects.
    const lines = slots.map((slot) => textOf(slot.node));

    // A selection that names nothing — "the ninth word" of a six-word
    // paragraph — leaves the passage as it was rather than guessing at what was
    // meant. The admin form refuses to store one, so this is the last line of
    // defence, not the usual path.
    const resolved = resolveSelections(part.scope, lines);

    // Grouped by paragraph: "wherever it appears" can land in several, and each
    // is rebuilt once with all of its ranges rather than once per range.
    const byBlock = new Map<number, { from: number; to: number }[]>();
    for (const range of resolved) {
      byBlock.set(range.block, [...(byBlock.get(range.block) ?? []), range]);
    }

    for (const [block, ranges] of byBlock) {
      const slot = slots[block];
      if (!slot) continue;
      slots[block] = restyled({ ...slot, node: formatted(slot.node, part, ranges) }, part);
    }
  }

  return { ...document, content: fromSlots(slots) };
}

export function modelAnswerDocument(question: WordQuestion, language: Language): JSONContent {
  // Deep-copied: the passage is the question's own data, and the worked answer
  // must not share nodes with the document it was derived from — a caller that
  // edits what it is given would otherwise edit the question.
  return applyParts(structuredClone(question.passage[language]), parts(question.modelAnswer));
}
