'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import styles from './SpreadsheetGrid.module.css';

export interface CellEditorProps {
  initial: string;
  /** True when opened from the formula bar, where the whole text is replaced. */
  selectAll: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
  onCommit: (text: string, move: 'down' | 'right' | 'none') => void;
  onCancel: () => void;
}

/**
 * The in-place editor: one input, positioned over the cell being edited.
 *
 * Mounted only while editing, which is why the grid can render thousands of
 * cells with no inputs in it at all. Its text is local state — the workbook
 * learns about it once, on commit, not on every keystroke, so typing a long
 * formula does not run the dependency graph forty times.
 */
export function CellEditor({
  initial,
  selectAll,
  left,
  top,
  width,
  height,
  label,
  onCommit,
  onCancel,
}: CellEditorProps) {
  const [text, setText] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Whether this editor has already finished.
   *
   * Committing moves focus back to the grid, which fires this input's `blur`
   * on the way out — and `blur` also commits. Without this guard, pressing
   * Enter records the same edit twice, and Undo then appears to do nothing the
   * first time it is pressed.
   */
  const settled = useRef(false);

  const finish = (move: 'down' | 'right' | 'none'): void => {
    if (settled.current) return;
    settled.current = true;
    onCommit(text, move);
  };

  const abandon = (): void => {
    if (settled.current) return;
    settled.current = true;
    onCancel();
  };

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    // Typing over a cell puts the cursor after the character just typed;
    // F2 and a double-click put it at the end of the existing text.
    if (selectAll) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }, [selectAll]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // Every key here is one this editor owns; letting them bubble would move
    // the selection underneath while the editor was still open.
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      finish('down');
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      finish('right');
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      abandon();
      return;
    }

    event.stopPropagation();
  };

  return (
    <input
      ref={inputRef}
      className={styles.editor}
      aria-label={label}
      value={text}
      style={{ left, top, minWidth: width, height }}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={onKeyDown}
      // Clicking away commits, as Excel does — losing what was typed because
      // the user clicked the ribbon would be the worst possible behaviour.
      onBlur={() => finish('none')}
    />
  );
}
