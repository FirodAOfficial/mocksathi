'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './LegalModal.module.css';

export interface LegalModalProps {
  title: string;
  lastUpdated: string;
  onClose: () => void;
  /** Called when the reader clicks "Accept" — distinct from `onClose`, which also fires for a plain dismiss (X, Escape, backdrop). */
  onAccept: () => void;
  children: ReactNode;
}

/**
 * A native `<dialog>`-based modal for the legal documents — same pattern as
 * the editor's `Dialog` (`src/components/dialogs/Dialog.tsx`), reimplemented
 * with the dashboard/auth `--db-*` tokens instead of that one's Office-ribbon
 * theme, since these documents are shown from screens outside the editor.
 *
 * `overflow: hidden` on the `<dialog>` element itself matters: browsers give
 * `<dialog>` its own default scrollbar, and stacking that under `.body`'s own
 * `overflow-y: auto` produced two visible scrollbars for content taller than
 * the modal. Only `.body` should ever scroll.
 */
export function LegalModal({ title, lastUpdated, onClose, onAccept, children }: LegalModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = ref.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className={styles.header}>
        <div>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <p className={styles.lastUpdated}>Last Updated: {lastUpdated}</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className={styles.body}>{children}</div>

      <div className={styles.footer}>
        <button type="button" className={styles.acceptButton} onClick={onAccept}>
          Accept
        </button>
      </div>
    </dialog>
  );
}
