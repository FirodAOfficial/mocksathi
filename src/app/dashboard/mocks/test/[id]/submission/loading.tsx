import styles from './loading.module.css';

/**
 * Instant loading state for "View Result"/"View Submission".
 *
 * Overrides the ambient `dashboard/loading.tsx`, which deliberately leaves
 * the sidebar and topbar clickable during a fetch — here the overlay covers
 * the whole viewport instead, so a candidate can't click off to another mock
 * (or open a second result) while this one is still being assembled.
 */
export default function SubmissionLoading() {
  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.text}>Loading your result…</p>
    </div>
  );
}
