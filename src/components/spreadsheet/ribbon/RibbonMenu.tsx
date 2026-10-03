'use client';

import type { ReactNode } from 'react';
import { Popover } from '@/components/controls/Popover';
import { Icon, type IconName } from '@/components/icons/Icon';
import styles from './SpreadsheetRibbon.module.css';

/**
 * A ribbon control that opens a menu: Excel's dropdowns (Insert, Format,
 * Clear, Find & Select) and the arrow half of its split buttons (Paste,
 * AutoSum, Merge & Center).
 *
 * Items follow the ribbon's rule — wired, or disabled with the reason in the
 * tooltip — so a menu cannot hide a command that looks live and does nothing.
 */

export interface RibbonMenuItem {
  label: string;
  glyph?: ReactNode;
  onSelect?: () => void;
  /** Ticked, for a choice that is currently in effect. */
  checked?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

/** A separator line, or a heading over the items that follow. */
export type RibbonMenuEntry = RibbonMenuItem | 'separator' | { heading: string };

export interface RibbonMenuProps {
  /** The accessible name and tooltip of the trigger. */
  label: string;
  /** What the trigger shows under or beside its glyph; defaults to `label`. */
  caption?: string;
  glyph?: ReactNode;
  icon?: IconName;
  /**
   * `large` stacks the caption under the glyph, `wide` sets it beside, and
   * `arrow` is the narrow arrow half of a split button.
   */
  size?: 'large' | 'wide' | 'arrow';
  disabled?: boolean;
  disabledReason?: string;
  align?: 'start' | 'end';
  /** The menu's items. Ignored when `content` is given. */
  items?: RibbonMenuEntry[];
  /** A custom panel, for menus that hold a form (Row Height, Find). */
  content?: (close: () => void) => ReactNode;
}

export function RibbonMenu({
  label,
  caption,
  glyph,
  icon,
  size = 'wide',
  disabled = false,
  disabledReason,
  align = 'start',
  items = [],
  content,
}: RibbonMenuProps) {
  const title = disabled && disabledReason ? `${label} — ${disabledReason}` : label;
  const sizeClass = size === 'large' ? styles.menuTrigger : size === 'arrow' ? styles.menuArrow : styles.menuWide;

  return (
    <Popover
      align={align}
      trigger={({ open, toggle, id, controls }) => (
        <button
          id={id}
          type="button"
          data-popover-trigger
          className={`${sizeClass} ${open ? styles.menuTriggerOpen : ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? controls : undefined}
          aria-label={label}
          title={title}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle}
        >
          {size === 'arrow' ? null : (
            <>
              {glyph ? <span aria-hidden="true">{glyph}</span> : null}
              {icon ? <Icon name={icon} size={size === 'large' ? 26 : 16} /> : null}
              <span className={styles.menuCaption}>{caption ?? label}</span>
            </>
          )}
          <span className={styles.menuCaret} aria-hidden="true">
            ▾
          </span>
        </button>
      )}
    >
      {({ close }) =>
        content ? (
          content(close)
        ) : (
          <div className={styles.menu} role="menu" aria-label={label}>
            {items.map((entry, index) => {
              if (entry === 'separator') {
                return <div key={`separator-${index}`} className={styles.menuSeparator} role="separator" />;
              }
              if ('heading' in entry) {
                return (
                  <div key={`heading-${entry.heading}`} className={styles.menuHeading}>
                    {entry.heading}
                  </div>
                );
              }

              return (
                <button
                  key={entry.label}
                  type="button"
                  role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                  aria-checked={entry.checked}
                  className={styles.menuItem}
                  disabled={entry.disabled}
                  title={entry.disabled && entry.disabledReason ? `${entry.label} — ${entry.disabledReason}` : entry.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    close();
                    entry.onSelect?.();
                  }}
                >
                  <span className={styles.menuGlyph} aria-hidden="true">
                    {entry.checked ? '✓' : entry.glyph}
                  </span>
                  {entry.label}
                </button>
              );
            })}
          </div>
        )
      }
    </Popover>
  );
}
