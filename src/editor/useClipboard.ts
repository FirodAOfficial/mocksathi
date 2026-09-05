'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { Mark } from '@tiptap/pm/model';
import { useUiStore } from '@/state/uiStore';

/**
 * Clipboard commands and the Format Painter.
 *
 * The ribbon's Cut/Copy/Paste buttons cannot rely on the browser's native
 * shortcut handling, because those shortcuts are the very thing the editor
 * suppresses. They go through the async Clipboard API instead, which can be
 * refused by the browser — every failure surfaces as a status-bar message
 * rather than being swallowed.
 */
export interface ClipboardActions {
  cut: () => void;
  copy: () => void;
  paste: () => void;
  toggleFormatPainter: () => void;
  formatPainterActive: boolean;
}

export function useClipboard(editor: Editor | null): ClipboardActions {
  const setNotice = useUiStore((state) => state.setNotice);
  const [formatPainterActive, setFormatPainterActive] = useState(false);
  const capturedMarks = useRef<readonly Mark[]>([]);

  const selectedText = useCallback((): string => {
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, '\n');
  }, [editor]);

  const copy = useCallback(() => {
    const text = selectedText();
    if (text === '') {
      setNotice('Select some text first.');
      return;
    }
    void navigator.clipboard
      .writeText(text)
      .then(() => setNotice('Copied.'))
      .catch(() => setNotice('The browser blocked access to the clipboard.'));
  }, [selectedText, setNotice]);

  const cut = useCallback(() => {
    if (!editor) return;
    const text = selectedText();
    if (text === '') {
      setNotice('Select some text first.');
      return;
    }
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        editor.chain().focus().deleteSelection().run();
        setNotice('Cut.');
      })
      .catch(() => setNotice('The browser blocked access to the clipboard.'));
  }, [editor, selectedText, setNotice]);

  const paste = useCallback(() => {
    if (!editor) return;

    void (async () => {
      try {
        // Prefer the HTML flavour so formatting survives; fall back to text
        // where the richer API is unavailable or refused.
        if (navigator.clipboard.read) {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            if (item.types.includes('text/html')) {
              const html = await (await item.getType('text/html')).text();
              editor.chain().focus().insertContent(html).run();
              return;
            }
          }
        }
        const text = await navigator.clipboard.readText();
        if (text !== '') editor.chain().focus().insertContent(text).run();
      } catch {
        setNotice('The browser blocked access to the clipboard. Use the system paste shortcut instead.');
      }
    })();
  }, [editor, setNotice]);

  const toggleFormatPainter = useCallback(() => {
    if (!editor) return;
    setFormatPainterActive((active) => {
      if (active) return false;
      // Capture the formatting under the cursor at the moment of activation.
      capturedMarks.current = editor.state.storedMarks ?? editor.state.selection.$from.marks();
      setNotice('Format Painter: select the text to format.');
      return true;
    });
  }, [editor, setNotice]);

  useEffect(() => {
    if (!editor || !formatPainterActive) return;

    const applyToSelection = (): void => {
      if (editor.state.selection.empty) return;

      const chain = editor.chain().focus().unsetAllMarks();
      for (const mark of capturedMarks.current) {
        chain.setMark(mark.type.name, mark.attrs);
      }
      chain.run();

      // Word's single-click painter applies once and switches itself off.
      setFormatPainterActive(false);
      setNotice(null);
    };

    editor.on('selectionUpdate', applyToSelection);
    return () => {
      editor.off('selectionUpdate', applyToSelection);
    };
  }, [editor, formatPainterActive, setNotice]);

  return { cut, copy, paste, toggleFormatPainter, formatPainterActive };
}
