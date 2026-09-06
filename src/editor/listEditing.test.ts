import { Editor } from '@tiptap/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildEditorExtensions } from './extensions';

/**
 * Pressing Enter in a list.
 *
 * Splitting a list item is text entry — it is how you get to the next line —
 * not a formatting command, so it stays on the keyboard alongside Shift-Enter
 * and the table's Tab. Nesting (Tab / Shift-Tab) is formatting and remains
 * ribbon-only.
 */
describe('Enter inside a list', () => {
  let editor: Editor;

  beforeEach(() => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    editor = new Editor({
      element,
      extensions: buildEditorExtensions(),
      content: '<ul><li><p>First</p></li></ul>',
    });
  });

  afterEach(() => editor.destroy());

  const pressEnter = (): void => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
  };

  const listItems = (): number => editor.view.dom.querySelectorAll('li').length;

  it('starts the next bullet on a single press', () => {
    editor.commands.focus('end');
    pressEnter();

    expect(listItems()).toBe(2);
  });

  it('does not need a second press to reach the next bullet', () => {
    editor.commands.focus('end');
    pressEnter();
    editor.commands.insertContent('Second');

    // The typed text lands in the new item, not in a stray paragraph inside
    // the first one.
    expect(editor.view.dom.querySelectorAll('li')[1]?.textContent).toBe('Second');
  });

  it('leaves the list when Enter is pressed on an empty item', () => {
    editor.commands.focus('end');
    pressEnter();
    pressEnter();

    expect(listItems()).toBe(1);
  });

  it('still refuses Tab, which nests and is a ribbon action', () => {
    editor.commands.setContent('<ul><li><p>One</p></li><li><p>Two</p></li></ul>');
    editor.commands.focus('end');

    const before = editor.getHTML();
    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );

    expect(editor.getHTML()).toBe(before);
  });
});
