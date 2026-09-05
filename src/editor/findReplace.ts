'use client';

import type { Editor } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * Find and Replace over the document's text.
 *
 * ProseMirror stores text in a tree, so searching needs a flat projection of it
 * plus a way back to document positions. `buildTextIndex` produces both, and
 * everything else here works in plain string terms.
 */

interface TextIndex {
  text: string;
  /** `positions[i]` is the document position of `text[i]`. */
  positions: number[];
}

function buildTextIndex(doc: ProseMirrorNode): TextIndex {
  let text = '';
  const positions: number[] = [];
  let firstBlockSeen = false;

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let offset = 0; offset < node.text.length; offset += 1) {
        text += node.text[offset];
        positions.push(pos + offset);
      }
      return false;
    }

    if (node.isBlock) {
      // A separator keeps matches from spanning a paragraph boundary, which
      // would otherwise produce selections across unrelated blocks.
      if (firstBlockSeen) {
        text += '\n';
        positions.push(pos);
      }
      firstBlockSeen = true;
    }
    return true;
  });

  return { text, positions };
}

export interface SearchOptions {
  matchCase: boolean;
}

export interface SearchResult {
  from: number;
  to: number;
}

function locate(index: TextIndex, query: string, startAt: number, options: SearchOptions): number {
  const haystack = options.matchCase ? index.text : index.text.toLowerCase();
  const needle = options.matchCase ? query : query.toLowerCase();

  const found = haystack.indexOf(needle, startAt);
  // Wrapping to the top matches Word, which searches the whole document rather
  // than stopping at the end.
  return found === -1 ? haystack.indexOf(needle, 0) : found;
}

/** Selects the next occurrence after the cursor. Returns false if there is none. */
export function findNext(editor: Editor, query: string, options: SearchOptions): boolean {
  if (query === '') return false;

  const index = buildTextIndex(editor.state.doc);
  if (index.text === '') return false;

  const selectionEnd = editor.state.selection.to;
  // Start just past the current selection so repeated presses advance.
  const startAt = Math.max(0, index.positions.findIndex((position) => position >= selectionEnd) + 1);

  const found = locate(index, query, startAt === 0 ? 0 : startAt, options);
  if (found === -1) return false;

  const from = index.positions[found];
  const lastChar = index.positions[found + query.length - 1];
  if (from === undefined || lastChar === undefined) return false;

  editor.chain().focus().setTextSelection({ from, to: lastChar + 1 }).run();
  return true;
}

/** Replaces the current selection if it already matches, then finds the next. */
export function replaceCurrent(editor: Editor, query: string, replacement: string, options: SearchOptions): boolean {
  if (query === '') return false;

  const { from, to } = editor.state.selection;
  const selected = editor.state.doc.textBetween(from, to, '\n');
  const matches = options.matchCase ? selected === query : selected.toLowerCase() === query.toLowerCase();

  if (!matches) return findNext(editor, query, options);

  editor.chain().focus().insertContentAt({ from, to }, replacement).run();
  return findNext(editor, query, options);
}

/** Replaces every occurrence in one transaction-per-match pass. Returns the count. */
export function replaceAll(editor: Editor, query: string, replacement: string, options: SearchOptions): number {
  if (query === '') return 0;

  let replacements = 0;
  // Each replacement shifts later positions, so the index is rebuilt each time
  // and the scan restarts past the text just inserted.
  let searchFrom = 0;

  for (let guard = 0; guard < 10_000; guard += 1) {
    const index = buildTextIndex(editor.state.doc);
    const haystack = options.matchCase ? index.text : index.text.toLowerCase();
    const needle = options.matchCase ? query : query.toLowerCase();

    const found = haystack.indexOf(needle, searchFrom);
    if (found === -1) break;

    const from = index.positions[found];
    const lastChar = index.positions[found + query.length - 1];
    if (from === undefined || lastChar === undefined) break;

    editor.chain().insertContentAt({ from, to: lastChar + 1 }, replacement).run();
    replacements += 1;
    searchFrom = found + replacement.length;
  }

  if (replacements > 0) editor.commands.focus();
  return replacements;
}
