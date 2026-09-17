'use client';

import Link from 'next/link';
import { useEffect, useId, useRef } from 'react';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './MockLimitModal.module.css';

export interface MockLimitModalProps {
  onClose: () => void;
}

/**
 * Shown instead of starting a new mock once a candidate on a capped,
 * unsubscribed plan has used every mock it allows.
 *
 * Built the same way `SelectExamModal` is — its own native `<dialog>` on the
 * dashboard's own `--db-*` tokens — rather than the shared
 * `src/components/dialogs/Dialog.tsx`, which is styled for the Office-chrome
 * editor and would look out of place here.
 */
export function MockLimitModal({ onClose }: MockLimitModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialogRef.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className={styles.header}>
        <div>
          <div className={styles.iconBadge}>
            <DashboardIcon name="lock" size={18} />
          </div>
          <h2 id={titleId} className={styles.title}>
            Free plan limit reached
          </h2>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <p className={styles.body}>
        No active subscription — you&apos;ve used every free mock your plan allows. Subscribe to
        keep practicing and unlock unlimited mocks.
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.later} onClick={onClose}>
          Maybe later
        </button>
        <Link href="/dashboard/subscription" className={styles.subscribe} onClick={onClose}>
          Subscribe to continue
        </Link>
      </div>
    </dialog>
  );
}
