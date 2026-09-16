import styles from './RouteLoading.module.css';

export interface RouteLoadingProps {
  label?: string;
}

/**
 * Instant loading state for the exam-taking routes (`/exam`, `/editor`,
 * `/spreadsheet`) — each does a server-side lookup (`paperFor` or similar)
 * before it can render, and previously a click on "Start" showed nothing
 * until that finished. Styled after the Office chrome (`--ui-font`,
 * `--focus-ring`) those pages use, not the candidate-portal dashboard.
 */
export function RouteLoading({ label = 'Loading…' }: RouteLoadingProps) {
  return (
    <div className={styles.page} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.text}>{label}</p>
    </div>
  );
}
