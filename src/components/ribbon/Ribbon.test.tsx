import { Editor } from '@tiptap/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEditorExtensions } from '@/editor/extensions';
import { sortParagraphs } from '@/editor/ribbonActions';
import { useUiStore } from '@/state/uiStore';
import { Ribbon } from './Ribbon';

/**
 * The ribbon's surface, checked the way a candidate meets it: the tabs Word has
 * are there, and nothing that looks live is inert.
 */

let editor: Editor;

beforeEach(() => {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: buildEditorExtensions(),
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
  });
});

afterEach(() => {
  editor.destroy();
  useUiStore.setState({ activeTab: 'home', showFormattingMarks: false, columns: 1, viewMode: 'print' });
  cleanup();
});

function open() {
  render(
    <Ribbon
      editor={editor}
      format={{
        bold: false, italic: false, underline: false, strike: false,
        superscript: false, subscript: false, bulletList: false, orderedList: false,
        align: null, lineHeight: null, styleId: 'Normal', fontFamily: null, fontSize: 11,
        color: null, highlight: null, canUndo: false, canRedo: false, words: 1, characters: 5,
      } as never}
      clipboard={{ cut: vi.fn(), copy: vi.fn(), paste: vi.fn(), canPaste: true } as never}
      onFind={vi.fn()}
      onReplace={vi.fn()}
      onWordCount={vi.fn()}
      onOpenParagraphDialog={vi.fn()}
      onOpenFontDialog={vi.fn()}
      onInsertLink={vi.fn()}
    />,
  );
}

describe('Ribbon tabs', () => {
  it('offers Word’s tab strip', () => {
    open();
    const tablist = screen.getByRole('tablist', { name: 'Ribbon' });

    for (const label of ['Home', 'Insert', 'Design', 'Layout', 'References', 'Mailings', 'Review', 'View', 'Help']) {
      expect(within(tablist).getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  /*
   * References and Mailings were a paragraph of prose apiece. A candidate
   * looking for Table of Contents found an explanation of why it was not
   * there, which is not the same as finding the ribbon Word has. Both are
   * drawn in full now, so the test is that Mailings — where nothing can work
   * without a data source — is still every command, each saying what it needs.
   */
  it('draws Mailings in full, with every command saying what it would need', async () => {
    open();
    await userEvent.click(screen.getByRole('tab', { name: 'Mailings' }));

    const buttons = within(screen.getByRole('tabpanel')).getAllByRole('button');

    expect(buttons.length).toBeGreaterThan(8);
    for (const button of buttons) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(button.getAttribute('title')).toMatch(/ — .+/);
    }
  });

  it('gives References the two commands that survive without pagination', async () => {
    open();
    await userEvent.click(screen.getByRole('tab', { name: 'References' }));

    const live = within(screen.getByRole('tabpanel'))
      .getAllByRole('button')
      .filter((button) => !(button as HTMLButtonElement).disabled)
      .map((button) => button.getAttribute('aria-label'));

    expect(live).toEqual(['Table of Contents', 'Insert Caption', 'Insert Table Caption']);
  });

  it('gives every disabled control a reason in its tooltip', async () => {
    open();

    for (const tab of ['Insert', 'Draw', 'Design', 'Layout', 'References', 'Mailings', 'Review', 'View']) {
      await userEvent.click(screen.getByRole('tab', { name: tab }));
      const disabled = within(screen.getByRole('tabpanel'))
        .queryAllByRole('button')
        .filter((button) => (button as HTMLButtonElement).disabled);

      for (const button of disabled) {
        // "Label — reason": a control the candidate cannot use must say why.
        expect(button.getAttribute('title')).toMatch(/ — .+/);
      }
    }
  });

  it('drives real page state from the Layout and View tabs', async () => {
    open();

    await userEvent.click(screen.getByRole('tab', { name: 'View' }));
    await userEvent.click(screen.getByRole('button', { name: 'Gridlines' }));
    expect(useUiStore.getState().showGridlines).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Draft' }));
    expect(useUiStore.getState().viewMode).toBe('draft');
  });

  it('toggles formatting marks from Home', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Show/Hide Formatting Marks' }));

    expect(useUiStore.getState().showFormattingMarks).toBe(true);
  });
});

describe('sortParagraphs', () => {
  it('reorders the selected paragraphs and keeps their formatting', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const sortable = new Editor({
      element,
      extensions: buildEditorExtensions(),
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Cherry', marks: [{ type: 'bold' }] }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Apple' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Banana' }] },
        ],
      },
    });

    sortable.commands.selectAll();
    sortParagraphs(sortable, 1);

    const paragraphs = sortable.state.doc.content.content.map((node) => node.textContent);
    expect(paragraphs).toEqual(['Apple', 'Banana', 'Cherry']);
    // Cherry moved last and is still bold: the node travelled, not just its text.
    expect(sortable.getHTML()).toContain('<strong>Cherry</strong>');

    sortable.destroy();
  });
});
