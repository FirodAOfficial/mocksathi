'use client';

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { MAX_COLUMNS, MAX_ROWS, formatAddress, type CellAddress, type RangeAddress } from '@/spreadsheet/model/address';
import styles from './SpreadsheetGrid.module.css';

/** Where a committed edit leaves the cursor. */
export type CommitMove = 'down' | 'up' | 'right' | 'left' | 'none';

/**
 * How the editor was opened, which is what decides what an arrow key means.
 *
 * Excel's two modes, and the distinction is not cosmetic:
 *
 * - **enter** — opened by typing over a cell. Arrow keys and clicks reach *the
 *   sheet*: in a formula they pick the cell being referred to, and in a plain
 *   entry they commit and move on, which is how a column of numbers gets typed.
 * - **edit** — opened with F2, a double-click or the formula bar. Arrow keys
 *   move the caret through the text, because the point of F2 is to fix a
 *   character in the middle of a formula.
 *
 * The status bar in Excel shows which one you are in for exactly this reason.
 */
export type EditorMode = 'enter' | 'edit';

export interface CellEditorHandle {
  /**
   * True when a click on the sheet should insert a reference rather than
   * commit the edit.
   */
  isPointing(): boolean;
  /** Puts `range` into the formula, replacing the reference last pointed at. */
  point(range: RangeAddress): void;
}

export interface CellEditorProps {
  initial: string;
  /** True when opened from the formula bar, where the whole text is replaced. */
  selectAll: boolean;
  mode: EditorMode;
  /** The cell being edited: where a pointed reference starts from. */
  origin: CellAddress;
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
  handleRef?: RefObject<CellEditorHandle | null>;
  /** The range currently being pointed at, so the grid can outline it. */
  onPointChange?: (range: RangeAddress | null) => void;
  onCommit: (text: string, move: CommitMove) => void;
  onCancel: () => void;
}

/**
 * Characters after which a formula is expecting a reference.
 *
 * This is what tells `=A1+` (waiting for an operand — point) apart from `=A1`
 * (a complete operand — an arrow key there means "edit the text"). It is the
 * same test Excel applies, and it is why `=SUM(` lets you drag out a range.
 */
const AWAITING_OPERAND = new Set(['=', '+', '-', '*', '/', '^', '(', ',', ':', ';', '&', '<', '>']);

const ARROW_DELTAS: Record<string, { rows: number; cols: number }> = {
  ArrowUp: { rows: -1, cols: 0 },
  ArrowDown: { rows: 1, cols: 0 },
  ArrowLeft: { rows: 0, cols: -1 },
  ArrowRight: { rows: 0, cols: 1 },
};

const ARROW_MOVES: Record<string, CommitMove> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * The in-place editor: one input, positioned over the cell being edited.
 *
 * Mounted only while editing, which is why the grid can render thousands of
 * cells with no inputs in it at all. Its text is local state — the workbook
 * learns about it once, on commit, not on every keystroke, so typing a long
 * formula does not run the dependency graph forty times. Point mode keeps that
 * property: the grid drives it through `handleRef`, an imperative handle, so a
 * click on a cell inserts a reference without the text ever becoming grid
 * state and re-rendering every visible cell on each keystroke.
 */
export function CellEditor({
  initial,
  selectAll,
  mode,
  origin,
  left,
  top,
  width,
  height,
  label,
  handleRef,
  onPointChange,
  onCommit,
  onCancel,
}: CellEditorProps) {
  const [text, setText] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * The mode can change after opening: F2 switches out of point mode, and so
   * does clicking into the text, exactly as Excel does.
   */
  const modeRef = useRef<EditorMode>(mode);

  /** The text, readable from the imperative handle without a stale closure. */
  const textRef = useRef(initial);

  /**
   * The span the last pointed reference occupies in the text.
   *
   * Pointing again *replaces* that span rather than appending, which is what
   * makes holding Down walk the reference down the column instead of producing
   * `=A2A3A4`. Typing anything clears it, because the reference is then the
   * user's text and no longer ours to overwrite.
   */
  const span = useRef<{ start: number; end: number } | null>(null);

  /** The range being pointed at, so an arrow key continues from it. */
  const target = useRef<{ anchor: CellAddress; focus: CellAddress } | null>(null);

  /**
   * Whether this editor has already finished.
   *
   * Committing moves focus back to the grid, which fires this input's `blur`
   * on the way out — and `blur` also commits. Without this guard, pressing
   * Enter records the same edit twice, and Undo then appears to do nothing the
   * first time it is pressed.
   */
  const settled = useRef(false);

  /**
   * Set while a click on the sheet is inserting a reference.
   *
   * Browsers suppress the focus change when the grid calls `preventDefault` on
   * the pointer event, but not every environment does, and a blur that slipped
   * through would commit the half-written formula the click was meant to
   * extend. Cleared on the next tick, so an ordinary click away still commits.
   */
  const pointingBlur = useRef(false);

  const finish = (move: CommitMove): void => {
    if (settled.current) return;
    settled.current = true;
    onPointChange?.(null);
    onCommit(textRef.current, move);
  };

  const abandon = (): void => {
    if (settled.current) return;
    settled.current = true;
    onPointChange?.(null);
    onCancel();
  };

  const write = (next: string, caret: number): void => {
    textRef.current = next;
    setText(next);

    // After React has painted the new value; setting it now would be undone by
    // the controlled update that follows.
    queueMicrotask(() => {
      inputRef.current?.setSelectionRange(caret, caret);
    });
  };

  /** True when the caret sits where a formula expects a cell reference. */
  const awaitingOperand = (): boolean => {
    const value = textRef.current;
    if (!value.startsWith('=')) return false;

    const caret = span.current ? span.current.start : (inputRef.current?.selectionStart ?? value.length);
    const head = value.slice(0, caret).trimEnd();
    if (head.length === 0) return false;

    return AWAITING_OPERAND.has(head[head.length - 1] ?? '');
  };

  const isPointing = (): boolean => modeRef.current === 'enter' && awaitingOperand();

  /** Writes `range` into the formula at the point position. */
  const point = (range: RangeAddress): void => {
    const value = textRef.current;
    const caret = inputRef.current?.selectionStart ?? value.length;
    const from = span.current?.start ?? caret;
    const to = span.current?.end ?? caret;

    const reference =
      range.start.row === range.end.row && range.start.col === range.end.col
        ? formatAddress(range.start)
        : `${formatAddress(range.start)}:${formatAddress(range.end)}`;

    span.current = { start: from, end: from + reference.length };
    write(`${value.slice(0, from)}${reference}${value.slice(to)}`, from + reference.length);
    onPointChange?.(range);
  };

  useImperativeHandle(
    handleRef,
    () => ({
      isPointing,
      point: (range: RangeAddress) => {
        pointingBlur.current = true;
        setTimeout(() => {
          pointingBlur.current = false;
        }, 0);

        target.current = { anchor: range.start, focus: range.end };
        point(range);
        inputRef.current?.focus();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the handle reads refs, so it never goes stale.
    [],
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    // Typing over a cell puts the cursor after the character just typed;
    // F2 and a double-click put it at the end of the existing text.
    if (selectAll) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }, [selectAll]);

  /** An arrow key in point mode: move the pointed reference and rewrite it. */
  const movePoint = (key: string, extend: boolean): void => {
    const delta = ARROW_DELTAS[key];
    if (!delta) return;

    // The first arrow after an operator starts from the cell being edited —
    // `=` then Up is always the cell above. After that the reference walks on
    // from where it got to, so holding Down runs down the column.
    const from = target.current?.focus ?? origin;
    const current = target.current;

    const focus: CellAddress = {
      row: Math.min(MAX_ROWS - 1, Math.max(0, from.row + delta.rows)),
      col: Math.min(MAX_COLUMNS - 1, Math.max(0, from.col + delta.cols)),
    };
    const anchor = extend && current ? current.anchor : focus;

    target.current = { anchor, focus };
    point(ordered(anchor, focus));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // Every key here is one this editor owns; letting them bubble would move
    // the selection underneath while the editor was still open.
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      finish(event.shiftKey ? 'up' : 'down');
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      finish(event.shiftKey ? 'left' : 'right');
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      abandon();
      return;
    }

    if (event.key === 'F2') {
      // Excel's F2 toggles out of point mode so the arrows edit the text.
      event.preventDefault();
      event.stopPropagation();
      modeRef.current = 'edit';
      span.current = null;
      target.current = null;
      onPointChange?.(null);
      return;
    }

    if (ARROW_DELTAS[event.key] && modeRef.current === 'enter' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      event.stopPropagation();

      // In a formula the arrow picks a reference; in a plain entry it commits
      // and moves, which is how a table of numbers is typed without reaching
      // for Enter between every cell.
      if (textRef.current.startsWith('=')) movePoint(event.key, event.shiftKey);
      else finish(ARROW_MOVES[event.key] ?? 'none');
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
      onChange={(event) => {
        // The user typed, so the last pointed reference is now their text: the
        // next click must insert beside it rather than overwrite it.
        span.current = null;
        target.current = null;
        onPointChange?.(null);
        textRef.current = event.target.value;
        setText(event.target.value);
      }}
      onKeyDown={onKeyDown}
      // Clicking into the text is Excel's other way out of point mode — you are
      // editing the formula now, not pointing at cells with it. The event must
      // not reach the sheet underneath, which would read it as a click on the
      // cell and close the editor mid-word.
      onPointerDown={(event) => {
        event.stopPropagation();
        modeRef.current = 'edit';
        span.current = null;
        target.current = null;
        onPointChange?.(null);
      }}
      // Double-clicking a word to select it is not a double-click on the cell.
      onDoubleClick={(event) => event.stopPropagation()}
      // Clicking away commits, as Excel does — losing what was typed because
      // the user clicked the ribbon would be the worst possible behaviour.
      onBlur={() => {
        if (pointingBlur.current) {
          inputRef.current?.focus();
          return;
        }
        finish('none');
      }}
    />
  );
}

/** Corners in reading order, which is the only order a reference is written in. */
function ordered(a: CellAddress, b: CellAddress): RangeAddress {
  return {
    start: { row: Math.min(a.row, b.row), col: Math.min(a.col, b.col) },
    end: { row: Math.max(a.row, b.row), col: Math.max(a.col, b.col) },
  };
}
