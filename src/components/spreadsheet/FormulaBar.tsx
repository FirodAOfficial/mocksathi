'use client';

import { useState, type KeyboardEvent } from 'react';
import { formatAddress, formatRange, parseRangeReference } from '@/spreadsheet/model/address';
import { useSelection, useWorkbookStore, useWorkbookVersion } from '@/spreadsheet/useWorkbook';
import { useSpreadsheetUiStore } from '@/state/spreadsheetUiStore';
import { focusSheetGrid } from './grid/SpreadsheetGrid';
import styles from './FormulaBar.module.css';

/**
 * The Name Box and the formula bar.
 *
 * Both inputs are uncontrolled and remounted by `key` whenever the cursor moves
 * or the workbook changes. That is deliberate: a controlled input would need an
 * effect to push the new cell's text into state, and resetting state from an
 * effect is exactly the pattern React's compiler rules forbid — it renders once
 * with the stale value before correcting itself. Remounting shows the right
 * text on the first paint.
 */
export function FormulaBar() {
  const store = useWorkbookStore();
  const selection = useSelection();
  const version = useWorkbookVersion();
  const [draft, setDraft] = useState<string | null>(null);
  const readOnly = useSpreadsheetUiStore((state) => state.readOnly);

  const active = selection.active;
  const ranges = selection.ranges;
  const first = ranges[0];

  // Excel shows the range while a multi-cell selection is being made, and the
  // single address otherwise.
  const nameBoxText =
    first && (first.start.row !== first.end.row || first.start.col !== first.end.col)
      ? formatRange({
          start: { ...first.start, anchor: { colAbsolute: false, rowAbsolute: false } },
          end: { ...first.end, anchor: { colAbsolute: false, rowAbsolute: false } },
        })
      : formatAddress(active);

  const committed = store.editText(active.row, active.col);
  const editing = draft !== null;

  const navigate = (text: string): void => {
    const reference = parseRangeReference(text.trim());
    if (!reference) return;

    store.selection.selectRange({
      start: { row: reference.start.row, col: reference.start.col },
      end: { row: reference.end.row, col: reference.end.col },
    });
    store.extendReach({ row: reference.end.row, col: reference.end.col });
    // Excel leaves you typing into the cell you jumped to, not into the box.
    focusSheetGrid();
  };

  const commit = (text: string): void => {
    store.setCellInput(active.row, active.col, text, 'formulaBar');
    setDraft(null);
    store.selection.moveBy(1, 0);
    focusSheetGrid();
  };

  const onFormulaKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(event.currentTarget.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDraft(null);
      event.currentTarget.blur();
    }
  };

  return (
    <div className={styles.bar}>
      <input
        // Remounted per cursor position so it always shows where we are.
        key={`name-${active.row}-${active.col}-${nameBoxText}`}
        className={styles.nameBox}
        defaultValue={nameBoxText}
        aria-label="Name Box"
        title="Name Box — type a cell or range to go to it"
        // Excel selects the whole reference when the box is focused, so typing
        // a destination replaces it. Without this, typing `Z5000` while it
        // reads `A3` produces `A3Z5000`, which parses as nothing and silently
        // goes nowhere.
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          navigate(event.currentTarget.value);
        }}
        onBlur={(event) => {
          event.currentTarget.value = nameBoxText;
        }}
      />

      <div className={styles.buttons} role="group" aria-label="Formula bar actions">
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Cancel"
          title="Cancel"
          disabled={!editing}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setDraft(null)}
        >
          ✕
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Enter"
          title="Enter"
          disabled={!editing}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => commit(draft ?? committed)}
        >
          ✓
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Insert Function"
          title={
            readOnly
              ? 'Insert Function — the sheet is protected'
              : 'Insert Function — starts a formula in the current cell'
          }
          disabled={readOnly}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            store.setCellInput(active.row, active.col, '=', 'formulaBar');
            void store.ensureEngine();
          }}
        >
          <em>fx</em>
        </button>
      </div>

      <input
        key={`formula-${active.row}-${active.col}-${version}`}
        className={styles.formula}
        defaultValue={committed}
        aria-label={`Formula bar, ${formatAddress(active)}`}
        spellCheck={false}
        readOnly={readOnly}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onFormulaKeyDown}
        onBlur={(event) => {
          if (draft === null) return;
          commit(event.currentTarget.value);
        }}
      />
    </div>
  );
}
