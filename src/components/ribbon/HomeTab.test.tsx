import { Editor } from '@tiptap/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEditorExtensions } from '@/editor/extensions';
import type { FormatState } from '@/editor/useFormatState';
import { HomeTab } from './HomeTab';

/**
 * Covers the wiring between the ribbon's controls and the editor: that a click
 * reaches the right command, and that button state is reported to assistive
 * technology. The commands themselves are tested separately.
 */
const baseFormat: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  subscript: false,
  superscript: false,
  bulletList: false,
  orderedList: false,
  align: 'left',
  style: 'Normal',
  fontFamily: null,
  fontSize: 11,
  color: null,
  highlight: null,
  lineHeight: null,
  borders: null,
  canUndo: false,
  canRedo: false,
  hasSelection: true,
  words: 4,
  characters: 19,
};

const clipboard = {
  cut: vi.fn(),
  copy: vi.fn(),
  paste: vi.fn(),
  toggleFormatPainter: vi.fn(),
  formatPainterActive: false,
};

describe('HomeTab', () => {
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
    vi.clearAllMocks();
  });

  afterEach(() => editor.destroy());

  const renderTab = (format: Partial<FormatState> = {}) =>
    render(
      <HomeTab
        editor={editor}
        format={{ ...baseFormat, ...format }}
        clipboard={clipboard}
        onFind={vi.fn()}
        onReplace={vi.fn()}
      />,
    );

  it('applies bold when the Bold button is clicked', async () => {
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));

    expect(editor.isActive('bold')).toBe(true);
  });

  it('reports toggle state through aria-pressed', () => {
    renderTab({ italic: true });

    expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies a gallery style and marks the current one as checked', async () => {
    renderTab({ style: 'Normal' });

    await userEvent.click(screen.getByRole('radio', { name: 'Heading 1' }));

    expect(editor.isActive('heading', { level: 1 })).toBe(true);
    expect(screen.getByRole('radio', { name: 'Normal' })).toHaveAttribute('aria-checked', 'true');
  });

  it('centres the paragraph from the alignment buttons', async () => {
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: 'Center' }));

    expect(editor.isActive({ textAlign: 'center' })).toBe(true);
  });

  it('turns the selection into a bulleted list', async () => {
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: 'Bullets' }));

    expect(editor.isActive('bulletList')).toBe(true);
  });

  it('sets the font family from the Font menu', async () => {
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: 'Font' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Georgia' }));

    expect(editor.getAttributes('textStyle').fontFamily).toBe('Georgia');
  });

  it('applies a highlight colour from the palette', async () => {
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: 'Text Highlight Colour options' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: '#ffff00' }));

    expect(editor.getAttributes('highlight').color).toBe('#ffff00');
  });

  it('disables Cut and Copy when nothing is selected, and says why', () => {
    renderTab({ hasSelection: false });

    const cut = screen.getByRole('button', { name: 'Cut' });
    expect(cut).toBeDisabled();
    expect(cut).toHaveAttribute('title', expect.stringContaining('select text first'));
  });

  it('routes clipboard buttons to the clipboard actions', async () => {
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(clipboard.copy).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Paste' }));
    expect(clipboard.paste).toHaveBeenCalledOnce();
  });

  it('labels every group so the ribbon structure is navigable', () => {
    renderTab();

    for (const group of ['Clipboard group', 'Font group', 'Paragraph group', 'Styles group', 'Editing group']) {
      expect(screen.getByRole('region', { name: group })).toBeInTheDocument();
    }
  });
});
