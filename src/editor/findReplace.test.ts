import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { buildEditorExtensions } from './extensions';
import { findNext, replaceAll, replaceCurrent } from './findReplace';

/**
 * Find and Replace, over a real editor.
 *
 * These are the behaviours that were broken: stepping onto the *next* match
 * rather than over it, and replacing without the document being focused — which
 * is the normal case, because the keyboard is in the dialog while you search.
 */

const editors: Editor[] = [];

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
});

function editorWith(...paragraphs: string[]): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);

  const editor = new Editor({
    element,
    extensions: buildEditorExtensions(),
    content: {
      type: 'doc',
      content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
    },
  });

  editors.push(editor);
  return editor;
}

/** What the current selection covers. */
function selected(editor: Editor): string {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, '\n');
}

const OPTIONS = { matchCase: false };

describe('findNext', () => {
  it('selects the first match, then the one after it', () => {
    const editor = editorWith('the cat sat on the mat');

    expect(findNext(editor, 'the', OPTIONS)).toBe(true);
    expect(editor.state.selection.from).toBe(1);
    expect(selected(editor)).toBe('the');

    expect(findNext(editor, 'the', OPTIONS)).toBe(true);
    // The second "the", at offset 15 of the paragraph.
    expect(editor.state.selection.from).toBe(16);
  });

  it('steps onto a match that starts immediately after the last one', () => {
    // The off-by-one this had: starting the next search one character past the
    // selection stepped over a match that began at the very next character.
    const editor = editorWith('aaa');

    expect(findNext(editor, 'a', OPTIONS)).toBe(true);
    expect(editor.state.selection.from).toBe(1);
    findNext(editor, 'a', OPTIONS);
    expect(editor.state.selection.from).toBe(2);
    findNext(editor, 'a', OPTIONS);
    expect(editor.state.selection.from).toBe(3);
  });

  it('wraps to the top after the last match, as Word does', () => {
    const editor = editorWith('one two one');

    findNext(editor, 'one', OPTIONS);
    findNext(editor, 'one', OPTIONS);
    expect(editor.state.selection.from).toBe(9);

    findNext(editor, 'one', OPTIONS);
    expect(editor.state.selection.from).toBe(1);
  });

  it('finds across paragraphs but never through one', () => {
    const editor = editorWith('first line', 'second line');

    expect(findNext(editor, 'second', OPTIONS)).toBe(true);
    expect(selected(editor)).toBe('second');
    // The paragraph break is a separator, so nothing matches across it.
    expect(findNext(editor, 'linesecond', OPTIONS)).toBe(false);
  });

  it('honours match case, and reports a miss rather than throwing', () => {
    const editor = editorWith('The Cat');

    expect(findNext(editor, 'cat', { matchCase: true })).toBe(false);
    expect(findNext(editor, 'Cat', { matchCase: true })).toBe(true);
    expect(findNext(editor, 'dog', OPTIONS)).toBe(false);
  });

  it('highlights the match, so it is visible while the keyboard is in the dialog', () => {
    // The reason Find looked broken: a browser paints a text selection only in
    // the focused element, and the focused element is the search box.
    const editor = editorWith('the cat');
    findNext(editor, 'cat', OPTIONS);

    const decorations = editor.view.dom.ownerDocument.body.innerHTML;
    expect(decorations).toContain('search-match');
  });
});

describe('replace', () => {
  it('replaces the found match and moves to the next', () => {
    const editor = editorWith('the cat and the dog');

    findNext(editor, 'the', OPTIONS);
    expect(replaceCurrent(editor, 'the', 'a', OPTIONS)).toBe(true);
    expect(editor.getText()).toBe('a cat and the dog');
    // And it has moved on to the remaining occurrence.
    expect(selected(editor)).toBe('the');
  });

  it('finds first when the selection is not already the match', () => {
    const editor = editorWith('the cat');

    // Nothing selected: Word's Replace finds before it replaces.
    expect(replaceCurrent(editor, 'cat', 'dog', OPTIONS)).toBe(true);
    expect(editor.getText()).toBe('the cat');
    expect(selected(editor)).toBe('cat');
  });

  it('replaces every occurrence and counts them', () => {
    const editor = editorWith('one one one', 'one more');

    expect(replaceAll(editor, 'one', 'two', OPTIONS)).toBe(4);
    expect(editor.getText()).toBe('two two two\n\ntwo more');
  });

  it('does not loop when the replacement contains the search text', () => {
    // "one" -> "one one" would match itself forever if the scan restarted at
    // the replacement rather than past it.
    const editor = editorWith('one');

    expect(replaceAll(editor, 'one', 'one one', OPTIONS)).toBe(1);
    expect(editor.getText()).toBe('one one');
  });

  it('replaces nothing, and reports nothing, for a query that is not there', () => {
    const editor = editorWith('the cat');
    expect(replaceAll(editor, 'dog', 'wolf', OPTIONS)).toBe(0);
    expect(editor.getText()).toBe('the cat');
  });
});
