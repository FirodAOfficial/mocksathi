import styles from './loading.module.css';

/**
 * Instant loading state for every route under `/dashboard`.
 *
 * `DashboardLayout` (the sidebar/topbar chrome) stays mounted and interactive
 * across a click like "View Submission" or "Start" — only the content area
 * this file wraps needs a fallback while the destination page's own data
 * (an attempt, a paper's questions, …) is fetched.
 */
export default function DashboardLoading() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.text}>Loading…</p>
    </div>
  );
}
