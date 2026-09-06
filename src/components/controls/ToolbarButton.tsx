'use client';

import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';
import styles from './ToolbarButton.module.css';

export interface ToolbarButtonProps {
  /** Accessible name, and the tooltip text. Always required. */
  label: string;
  icon?: IconName;
  /** Letterform buttons (B, I, U) render a character instead of an icon. */
  glyph?: ReactNode;
  /**
   * `large` renders the label beneath the icon; `wide` renders it beside, which
   * is the shape Word uses in stacked groups like Insert's Pages and Links.
   */
  size?: 'small' | 'large' | 'wide';
  /** Toggled on — reported to assistive technology as `aria-pressed`. */
  active?: boolean;
  disabled?: boolean;
  /** Explains *why* a control is unavailable; appended to the tooltip. */
  disabledReason?: string;
  onClick?: () => void;
  className?: string;
}

export function ToolbarButton({
  label,
  icon,
  glyph,
  size = 'small',
  active = false,
  disabled = false,
  disabledReason,
  onClick,
  className,
}: ToolbarButtonProps) {
  const title = disabled && disabledReason ? `${label} — ${disabledReason}` : label;

  return (
    <button
      type="button"
      className={[styles.button, styles[size] ?? styles.small, active ? styles.active : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      // Toggle buttons expose state; one-shot commands (Undo, Copy) must not,
      // or a screen reader announces them as permanently "not pressed".
      aria-pressed={onClick && isToggle(active) ? active : undefined}
      title={title}
      aria-label={label}
      disabled={disabled}
      // The ribbon must never steal the selection: without this, clicking a
      // button blurs the editor and collapses the range being formatted.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {glyph ? <span className={styles.glyph}>{glyph}</span> : null}
      {icon ? <Icon name={icon} size={size === 'large' ? 26 : 18} /> : null}
      {size === 'small' ? null : <span className={styles.caption}>{label}</span>}
    </button>
  );
}

/** `active` is only meaningful for controls that actually toggle. */
function isToggle(active: boolean | undefined): active is boolean {
  return typeof active === 'boolean';
}
