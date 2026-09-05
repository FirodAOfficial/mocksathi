'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

export interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * A modal dialog.
 *
 * Uses the native `<dialog>` element so the browser provides the modal
 * semantics, the top-layer stacking and the focus containment, rather than
 * reimplementing a focus trap that would inevitably differ from the platform.
 */
export function Dialog({ title, onClose, children, footer }: DialogProps) {
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
        // Escape fires `cancel`; let React own the open state rather than
        // letting the element close itself out from under it.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clicking the backdrop lands on the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className={styles.titleBar}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className={styles.body}>{children}</div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </dialog>
  );
}
