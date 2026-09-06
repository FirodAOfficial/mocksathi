'use client';

import { useRef, useState } from 'react';
import { Icon } from '../icons/Icon';
import { Popover } from './Popover';
import styles from './NumberCombo.module.css';

export interface NumberComboProps {
  label: string;
  /** The current value, or null when the selection is mixed. */
  value: number | null;
  /** The presets offered in the drop-down. Any value in range may be typed. */
  options: readonly number[];
  onChange: (value: number) => void;
  min: number;
  max: number;
  width?: number;
  /** Shown when nothing is selected, e.g. a mixed-format selection. */
  placeholder?: string;
}

/**
 * An editable combo box of numbers, matching Word's Font Size control.
 *
 * The drop-down is a convenience, not the whole range: Word's size list jumps
 * 14 → 16, yet a paper may ask for 15, and the box is where you type it. A
 * read-only `SelectMenu` cannot express that, so this control pairs a text
 * field with the same preset list.
 *
 * Typing here does not disturb the document selection. The field takes DOM
 * focus, but ProseMirror keeps its selection in state and `onChange` runs
 * through a chain that calls `focus()` first — so the value lands on whatever
 * was selected before the box was clicked, as it does in Word.
 */
export function NumberCombo({
  label,
  value,
  options,
  onChange,
  min,
  max,
  width = 52,
  placeholder = '',
}: NumberComboProps) {
  /** Non-null while the field is being typed into; null means "show `value`". */
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (text: string): void => {
    setDraft(null);
    const parsed = Number.parseFloat(text);
    if (!Number.isFinite(parsed)) return;
    // Word accepts half points and silently clamps to the range it supports.
    const clamped = Math.min(max, Math.max(min, Math.round(parsed * 2) / 2));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <Popover
      trigger={({ open, toggle, id, controls }) => (
        <div
          data-popover-trigger
          className={`${styles.combo} ${open ? styles.comboOpen : ''}`}
          style={{ width }}
        >
          <input
            ref={inputRef}
            id={id}
            type="text"
            inputMode="decimal"
            className={styles.input}
            aria-label={label}
            title={label}
            value={draft ?? (value === null ? placeholder : String(value))}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit(event.currentTarget.value);
                // Word hands the caret back to the document once a size is
                // entered, so the candidate can keep working.
                event.currentTarget.blur();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setDraft(null);
                event.currentTarget.blur();
              }
            }}
          />
          <button
            type="button"
            className={styles.arrow}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? controls : undefined}
            aria-label={`${label} presets`}
            title={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={toggle}
          >
            <Icon name="chevron-down" size={14} />
          </button>
        </div>
      )}
    >
      {({ close }) => (
        <div className={styles.list}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === value}
              className={`${styles.option} ${option === value ? styles.optionSelected : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setDraft(null);
                onChange(option);
                close();
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
