import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Fills the width of its container, for a form's submit on a phone. */
  block?: boolean;
  children: ReactNode;
  className?: string;
}

export interface ButtonProps
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
  /**
   * Shows a spinner beside the label and marks the control busy.
   *
   * The button is *not* disabled while loading. A disabled button loses focus,
   * which throws a keyboard user back to the top of the form at the exact
   * moment they are waiting for an answer, and it stops screen readers
   * announcing the `aria-busy` change. `aria-disabled` says "do not press
   * this" without taking it out of the tab order.
   */
  loading?: boolean;
}

function classesFor({ variant = 'primary', size = 'md', block, className }: CommonProps): string {
  return [
    styles.button,
    styles[variant],
    size === 'md' ? '' : styles[size],
    block ? styles.block : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The product's button.
 *
 * Not for the Word or Excel ribbons — those use `ToolbarButton`, which imitates
 * Office deliberately. This is for the dashboard, the auth screens, the public
 * pages and the dialogs.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      // `type` defaults to "submit" inside a form, which has submitted a lot of
      // forms nobody meant to submit. Explicit, unless the caller says so.
      type={type}
      className={classesFor({ variant, size, block, className, children })}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends CommonProps {
  href: string;
  /** Set for an address outside the app; adds the usual safety attributes. */
  external?: boolean;
}

/**
 * The same thing that navigates instead of acting.
 *
 * A separate component rather than an `as` prop, because the two take genuinely
 * different attributes — and because an `<a>` styled as a button still has to
 * be an `<a>`, so Cmd-click, middle-click and "open in new tab" keep working.
 */
export function ButtonLink({ href, external = false, ...props }: ButtonLinkProps) {
  const className = classesFor(props);

  if (external) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {props.children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {props.children}
    </Link>
  );
}
