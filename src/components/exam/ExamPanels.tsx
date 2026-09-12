'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './ExamPanels.module.css';

/**
 * The exam side panels, and the drawer handles that open them.
 *
 * A column on a wide screen; a drawer over the document below 1280px, where
 * three columns cannot coexist. Shared by both editors — the Word paper and the
 * spreadsheet paper are sat by the same candidates, and a panel that behaved
 * differently between them would be testing the app rather than the skill.
 */

export type DrawerSide = 'questions' | 'summary';

export interface ExamPanelProps {
  side: 'left' | 'right';
  open: boolean;
  isMobile: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function ExamPanel({ side, open, isMobile, onClose, children }: ExamPanelProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  /*
   * Escape closes it, and focus goes in and comes back out.
   *
   * The focus half is not a nicety. `aria-modal="true"` tells assistive
   * technology the rest of the page is not there; leaving focus on the button
   * behind the drawer would strand a screen-reader or keyboard user on an
   * element their software has just been told to ignore. Tab is kept inside
   * for the same reason, and the trigger gets focus back on close so the way
   * out lands where the way in started.
   */
  useEffect(() => {
    if (!isMobile || !open) return;

    const drawer = drawerRef.current;
    const returnTo = document.activeElement as HTMLElement | null;

    const focusable = (): HTMLElement[] =>
      [
        ...(drawer?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? []),
      ].filter((element) => element.offsetParent !== null);

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;

      // Wrap at both ends rather than letting Tab walk out into the page.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      returnTo?.focus();
    };
  }, [isMobile, open, onClose]);

  if (!isMobile) return <div className={styles.column}>{children}</div>;
  if (!open) return null;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={drawerRef}
        className={`${styles.drawer} ${side === 'left' ? styles.drawerLeft : styles.drawerRight}`}
        role="dialog"
        aria-modal="true"
        aria-label={side === 'left' ? 'Questions' : 'Progress and submit'}
      >
        <button type="button" className={styles.drawerClose} onClick={onClose}>
          Close
        </button>
        <div className={styles.drawerBody}>{children}</div>
      </div>
    </>
  );
}

export interface ExamDrawerBarProps {
  open: DrawerSide | null;
  onToggle: (side: DrawerSide) => void;
}

/**
 * The drawer handles, at the bottom of the screen where a thumb reaches.
 *
 * Only rendered on the layout that has drawers — on a wide screen both panels
 * are already on the page and a button to open them would be a lie.
 */
export function ExamDrawerBar({ open, onToggle }: ExamDrawerBarProps) {
  return (
    <nav className={styles.drawerBar} aria-label="Exam panels">
      <button
        type="button"
        className={styles.drawerTab}
        aria-expanded={open === 'questions'}
        onClick={() => onToggle('questions')}
      >
        Questions
      </button>
      <button
        type="button"
        className={styles.drawerTab}
        aria-expanded={open === 'summary'}
        onClick={() => onToggle('summary')}
      >
        Progress &amp; Submit
      </button>
    </nav>
  );
}
