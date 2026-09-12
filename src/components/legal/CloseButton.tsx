'use client';

import { useRouter } from 'next/navigation';
import { consumeLegalBackSteps } from './legalCloseTracking';
import styles from './CloseButton.module.css';

/**
 * Jumps back to wherever the visitor entered this cluster of pages from —
 * skipping every intermediate legal page in one native history navigation
 * (`history.go(-n)`, the same underlying mechanism `router.back()` uses,
 * just more than one step at a time) rather than a fresh `router.push`,
 * which is a brand-new navigation with no cache to restore from and was
 * visibly slower. Falls back to "/" only when nothing was tracked at all —
 * a bookmarked or directly-typed visit, with no history to jump back into.
 */
export function CloseButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className={styles.close}
      aria-label="Close and go back"
      onClick={() => {
        const steps = consumeLegalBackSteps();
        if (steps) window.history.go(-steps);
        else router.push('/');
      }}
    >
      ✕
    </button>
  );
}
