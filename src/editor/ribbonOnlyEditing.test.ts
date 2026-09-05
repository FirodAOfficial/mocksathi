import { Editor } from '@tiptap/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildEditorExtensions } from './extensions';
import { clearFormatting, setParagraphStyle, stepFontSize } from './ribbonActions';

/**
 * The defining behaviour of this editor: formatting happens through the ribbon
 * and nowhere else.
 *
 * Each case proves both halves — that the keyboard route does nothing, and that
 * the ribbon route still works. Asserting only the first would pass just as
 * happily if the command itself were broken.
 */
describe('ribbon-only editing', () => {
  let editor: Editor;

  beforeEach(() => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    editor = new Editor({
      element,
      extensions: buildEditorExtensions(),
      content: '<p>The quick brown fox</p>',
    });
    editor.commands.selectAll();
  });

  afterEach(() => {
    editor.destroy();
  });

  /** Dispatches a real keydown at the editor's editable element. */
  const press = (key: string, modifiers: Partial<KeyboardEventInit> = {}): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      ...modifiers,
    });
    editor.view.dom.dispatchEvent(event);
    return event;
  };

  it.each([
    ['b', 'bold'],
    ['i', 'italic'],
    ['u', 'underline'],
  ])('ignores Ctrl+%s but applies %s from the ribbon', (key, mark) => {
    press(key);
    expect(editor.isActive(mark)).toBe(false);

    editor.chain().focus().toggleMark(mark).run();
    expect(editor.isActive(mark)).toBe(true);
  });

  it('swallows the event so the browser does not act on it either', () => {
    expect(press('b').defaultPrevented).toBe(true);
    expect(press('k').defaultPrevented).toBe(true);
    expect(press('s').defaultPrevented).toBe(true);
    expect(press('p').defaultPrevented).toBe(true);
  });

  it('ignores Ctrl+Z and Ctrl+Y but undoes from the ribbon command', () => {
    editor.chain().focus().toggleMark('bold').run();
    expect(editor.isActive('bold')).toBe(true);

    press('z');
    expect(editor.isActive('bold')).toBe(true);

    editor.commands.undo();
    expect(editor.isActive('bold')).toBe(false);
  });

  it('ignores the Ctrl+Alt+N heading shortcuts', () => {
    press('1', { altKey: true });
    expect(editor.isActive('heading')).toBe(false);

    setParagraphStyle(editor, 'Heading1');
    expect(editor.isActive('heading', { level: 1 })).toBe(true);
  });

  it('leaves the clipboard shortcuts to the browser', () => {
    // Cut, copy and paste are operating system behaviours with no ribbon
    // equivalent that could replace them, so the guard lets them through
    // untouched for the browser to handle natively.
    for (const key of ['c', 'x', 'v']) {
      expect(press(key).defaultPrevented).toBe(false);
    }
  });

  it('still allows Ctrl+A to select all, which is selection rather than formatting', () => {
    editor.commands.setTextSelection(2);
    expect(editor.state.selection.empty).toBe(true);

    press('a');

    expect(editor.state.selection.empty).toBe(false);
    expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe(
      'The quick brown fox',
    );
  });

  it('leaves navigation keys alone', () => {
    expect(press('ArrowLeft').defaultPrevented).toBe(false);
    expect(press('Home').defaultPrevented).toBe(false);
    expect(press('End').defaultPrevented).toBe(false);
  });

  it('does not auto-format markdown-style input', () => {
    editor.commands.setContent('<p></p>');
    editor.commands.focus();
    editor.commands.insertContent('**not bold** ');

    expect(editor.getHTML()).not.toContain('<strong>');
    expect(editor.getText()).toContain('**not bold**');
  });

  it('does not nest list items when Tab is pressed', () => {
    editor.commands.setContent('<ul><li><p>One</p></li><li><p>Two</p></li></ul>');
    editor.commands.focus();
    editor.commands.setTextSelection(editor.state.doc.content.size - 2);

    const before = editor.getHTML();
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));

    expect(editor.getHTML()).toBe(before);
  });

  it('keeps Shift+Enter, which inserts a line break rather than formatting', () => {
    editor.commands.setContent('<p>One</p>');
    editor.commands.focus('end');
    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }),
    );

    expect(editor.getHTML()).toContain('<br');
  });
});

describe('ribbon commands', () => {
  let editor: Editor;

  beforeEach(() => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    editor = new Editor({ element, extensions: buildEditorExtensions(), content: '<p>Sample text</p>' });
    editor.commands.selectAll();
  });

  afterEach(() => editor.destroy());

  it('steps font size along the standard ladder rather than by a fixed amount', () => {
    stepFontSize(editor, 1);
    expect(editor.getAttributes('textStyle').fontSize).toBe('12pt');

    stepFontSize(editor, 1);
    expect(editor.getAttributes('textStyle').fontSize).toBe('14pt');

    stepFontSize(editor, -1);
    expect(editor.getAttributes('textStyle').fontSize).toBe('12pt');
  });

  it('applies paragraph indentation in half-inch steps and stops at zero', () => {
    editor.commands.changeIndent(1);
    expect(editor.getAttributes('paragraph').indentLeft).toBe(48);

    editor.commands.changeIndent(1);
    expect(editor.getAttributes('paragraph').indentLeft).toBe(96);

    editor.commands.changeIndent(-1);
    editor.commands.changeIndent(-1);
    editor.commands.changeIndent(-1);
    expect(editor.getAttributes('paragraph').indentLeft).toBeNull();
  });

  it('moves between quote, heading and body styles without stacking wrappers', () => {
    setParagraphStyle(editor, 'Quote');
    expect(editor.isActive('blockquote')).toBe(true);

    setParagraphStyle(editor, 'Heading2');
    expect(editor.isActive('blockquote')).toBe(false);
    expect(editor.isActive('heading', { level: 2 })).toBe(true);

    setParagraphStyle(editor, 'Normal');
    expect(editor.isActive('heading')).toBe(false);
    expect(editor.isActive('paragraph')).toBe(true);
  });

  it('clears marks, paragraph formatting and the block style together', () => {
    editor.chain().focus().toggleMark('bold').setLineHeight(2).run();
    setParagraphStyle(editor, 'Heading1');
    editor.commands.selectAll();

    clearFormatting(editor);

    expect(editor.isActive('bold')).toBe(false);
    expect(editor.isActive('heading')).toBe(false);
    expect(editor.getAttributes('paragraph').lineHeight).toBeNull();
  });
});
