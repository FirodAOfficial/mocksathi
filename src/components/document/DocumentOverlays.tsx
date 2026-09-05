'use client';

import Link from 'next/link';
import type { DocumentError } from '@/services/document/errors';
import { Icon } from '../icons/Icon';
import styles from './DocumentOverlays.module.css';

export function LoadingOverlay({ url }: { url: string }) {
  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <div className={styles.panel}>
        <div className={styles.spinner} aria-hidden="true" />
        <p className={styles.heading}>Opening document…</p>
        {/* The address is shown as plain text, never as a link: it is
            third-party input and must not become a click target. */}
        <p className={styles.detail}>{url}</p>
      </div>
    </div>
  );
}

export interface DocumentErrorOverlayProps {
  error: DocumentError;
  onRetry: () => void;
}

export function DocumentErrorOverlay({ error, onRetry }: DocumentErrorOverlayProps) {
  return (
    <div className={styles.overlay} role="alert">
      <div className={styles.panel}>
        <Icon name="error" size={36} className={styles.errorIcon} />
        <h2 className={styles.heading}>{error.title}</h2>
        <p className={styles.message}>{error.userMessage}</p>
        {error.detail ? <p className={styles.detail}>{error.detail}</p> : null}

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onRetry}>
            Try again
          </button>
          <Link href="/editor" className={styles.secondary}>
            Start a blank document
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Reports formatting the parser could not represent.
 *
 * Shown once above the document and dismissible, because the requirement is
 * that loss is visible — not that it interrupts editing.
 */
export function UnsupportedNotice({ features, onDismiss }: { features: string[]; onDismiss: () => void }) {
  if (features.length === 0) return null;

  return (
    <div className={styles.notice} role="status">
      <Icon name="warning" size={16} className={styles.noticeIcon} />
      <div className={styles.noticeBody}>
        <strong>Some formatting could not be shown.</strong>
        <ul className={styles.noticeList}>
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </div>
      <button type="button" className={styles.noticeClose} onClick={onDismiss} aria-label="Dismiss notice">
        ✕
      </button>
    </div>
  );
}
