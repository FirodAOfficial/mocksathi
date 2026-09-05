'use client';

import type { CSSProperties } from 'react';
import { Icon } from '../icons/Icon';
import { Popover } from './Popover';
import styles from './SelectMenu.module.css';

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  /** Lets an option preview itself — a font name shown in that font. */
  optionStyle?: CSSProperties;
}

export interface SelectMenuProps<T extends string | number> {
  label: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Shown when nothing is selected, e.g. a mixed-format selection. */
  placeholder?: string;
  width?: number;
  disabled?: boolean;
}

/**
 * A read-only combo box, matching the ribbon's font, size and style pickers.
 *
 * It is a `menu` of `menuitemradio`s rather than a native `<select>` because
 * the options need to preview themselves (font names in their own typeface,
 * gallery styles at their real weight), which a native select cannot do.
 */
export function SelectMenu<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = '',
  width = 120,
  disabled = false,
}: SelectMenuProps<T>) {
  const selected = options.find((option) => option.value === value);

  return (
    <Popover
      trigger={({ open, toggle, id, controls }) => (
        <button
          id={id}
          type="button"
          data-popover-trigger
          className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
          style={{ width }}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? controls : undefined}
          aria-label={label}
          title={label}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle}
        >
          <span className={styles.value}>{selected?.label ?? placeholder}</span>
          <Icon name="chevron-down" size={14} />
        </button>
      )}
    >
      {({ close }) => (
        <div className={styles.list}>
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className={`${styles.option} ${option.value === value ? styles.optionSelected : ''}`}
              style={option.optionStyle}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                close();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
