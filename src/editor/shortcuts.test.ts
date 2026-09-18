import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildEditorExtensions } from './extensions';

/**
 * Word's keyboard shortcuts.
 *
 * The paper this app stands in for is sat in Word, where Ctrl+B is how most
 * people bold something. These assert the bindings exist and reach the same
 * commands the ribbon buttons do — and that the keys Word does *not* own are
 * still swallowed, so Ctrl+S does not open the browser's save dialog in the
 * middle of a sitting.
 */

const editors: Editor[] = [];

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
});

function editorWith(handlers: { onFind?: () => void; onReplace?: () => void } = {}): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);

  const editor = new Editor({
    element,
    extensions: buildEditorExtensions({
      onFind: handlers.onFind ?? null,
      onReplace: handlers.onReplace ?? null,
    }),
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'the quick brown fox' }] }] },
  });

  editors.push(editor);
  editor.commands.selectAll();
  return editor;
}

/**
 * Presses a key with modifiers, as the browser would deliver it.
 *
 * `keyCode` is not decoration. For a shifted letter the browser reports
 * `key: "D"`, and prosemirror-keymap falls back to the key *code* to find a
 * binding written the conventional way (`Mod-Shift-d`). An event without one
 * matches nothing — which says something about the event, not about the
 * binding, so the test sends what a keyboard sends.
 */
const KEY_CODES: Record<string, number> = { '[': 219, ']': 221, '=': 187, ' ': 32 };

function press(editor: Editor, key: string, modifiers: { shift?: boolean; alt?: boolean } = {}): boolean {
  const event = new KeyboardEvent('keydown', {
    key,
    keyCode: KEY_CODES[key] ?? key.toUpperCase().charCodeAt(0),
    ctrlKey: true,
    shiftKey: modifiers.shift ?? false,
    altKey: modifiers.alt ?? false,
    bubbles: true,
    cancelable: true,
  } as KeyboardEventInit);

  editor.view.dom.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('Word shortcuts', () => {
  it('applies character formatting', () => {
    const editor = editorWith();

    press(editor, 'b');
    expect(editor.isActive('bold')).toBe(true);

    press(editor, 'i');
    expect(editor.isActive('italic')).toBe(true);

    press(editor, 'u');
    expect(editor.isActive('underline')).toBe(true);

    // And they toggle back off, as Word's do.
    press(editor, 'b');
    expect(editor.isActive('bold')).toBe(false);
  });

  it('gives Ctrl+Shift+D a double underline, not a second underline', () => {
    const editor = editorWith();
    press(editor, 'D', { shift: true });

    expect(editor.isActive('underline')).toBe(true);
    expect(editor.getAttributes('underline').style).toBe('double');
  });

  it('steps the font size along the ladder', () => {
    const editor = editorWith();

    press(editor, ']');
    expect(editor.getAttributes('textStyle').fontSize).toBe('12pt');
    press(editor, ']');
    expect(editor.getAttributes('textStyle').fontSize).toBe('14pt');
    press(editor, '[');
    expect(editor.getAttributes('textStyle').fontSize).toBe('12pt');
  });

  it('aligns and spaces paragraphs', () => {
    const editor = editorWith();

    press(editor, 'e');
    expect(editor.isActive({ textAlign: 'center' })).toBe(true);
    press(editor, 'r');
    expect(editor.isActive({ textAlign: 'right' })).toBe(true);
    press(editor, 'j');
    expect(editor.isActive({ textAlign: 'justify' })).toBe(true);

    press(editor, '2');
    expect(editor.getAttributes('paragraph').lineHeight).toBe(2);
  });

  it('applies heading styles and takes them off again', () => {
    const editor = editorWith();

    press(editor, '1', { alt: true });
    expect(editor.isActive('heading', { level: 1 })).toBe(true);

    press(editor, 'N', { shift: true });
    expect(editor.isActive('paragraph')).toBe(true);
  });

  it('opens the dialogs the shell owns', () => {
    const onFind = vi.fn();
    const onReplace = vi.fn();
    const editor = editorWith({ onFind, onReplace });

    press(editor, 'f');
    expect(onFind).toHaveBeenCalledOnce();

    press(editor, 'h');
    expect(onReplace).toHaveBeenCalledOnce();
  });

  it('undoes and redoes', () => {
    const editor = editorWith();

    press(editor, 'b');
    expect(editor.isActive('bold')).toBe(true);

    press(editor, 'z');
    expect(editor.isActive('bold')).toBe(false);

    press(editor, 'y');
    expect(editor.isActive('bold')).toBe(true);
  });

  it('leaves the clipboard to the browser', () => {
    // The ribbon cannot replace cut, copy and paste, and blocking them would
    // break ordinary text entry — so the guard lets them through untouched.
    const editor = editorWith();
    for (const key of ['c', 'x', 'v']) {
      expect(press(editor, key)).toBe(false);
    }
  });

  it('selects the whole document with Ctrl+A', () => {
    const editor = editorWith();
    editor.commands.setTextSelection(2);
    expect(editor.state.selection.empty).toBe(true);

    press(editor, 'a');
    // Handled by ProseMirror itself rather than passed to the browser, which is
    // what keeps the selection inside the document.
    expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe(
      'the quick brown fox',
    );
  });

  it('still swallows the keys Word does not own', () => {
    // Ctrl+S would otherwise open the browser's save dialog mid-paper.
    const editor = editorWith();
    expect(press(editor, 's')).toBe(true);
    expect(press(editor, 'p')).toBe(true);
  });
});
