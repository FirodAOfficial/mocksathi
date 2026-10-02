'use client';

import { useEffect } from 'react';
import styles from './Toast.module.css';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastProps {
  message: string;
  tone?: ToastTone;
  onDismiss: () => void;
  /** Milliseconds before it goes on its own. `null` keeps it until dismissed. */
  duration?: number | null;
}

/**
 * One transient message, bottom-centre.
 *
 * For what has already happened. Anything the user has to act on belongs
 * inline beside the thing it concerns, where it will still be when they go
 * looking for it — a toast that carries a decision is a decision with a
 * timer on it.
 *
 * An error does not auto-dismiss by default. Someone who looked away for the
 * four seconds a success message needs has not been told anything.
 */
export function Toast({ message, tone = 'info', onDismiss, duration }: ToastProps) {
  const ms = duration === undefined ? (tone === 'error' ? null : 4000) : duration;

  useEffect(() => {
    if (ms === null) return;
    const timer = setTimeout(onDismiss, ms);
    return () => clearTimeout(timer);
  }, [ms, onDismiss, message]);

  return (
    <div className={`${styles.toast} ${styles[tone]}`}>
      <p className={styles.message}>{message}</p>
      <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

/**
 * The region toasts appear in.
 *
 * Rendered whether or not anything is in it, because a live region has to
 * exist before the text arrives or the browser has no change to announce.
 * `polite`, not `assertive`: a saved confirmation should wait for a gap in
 * what the user is already being told.
 */
export function ToastRegion({ children }: { children?: React.ReactNode }) {
  return (
    <div className={styles.region} role="status" aria-live="polite" aria-atomic="false">
      {children}
    </div>
  );
}
