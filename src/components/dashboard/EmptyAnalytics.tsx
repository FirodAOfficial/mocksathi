import { DashboardIcon } from './icons/DashboardIcon';
import styles from './EmptyAnalytics.module.css';

export interface EmptyAnalyticsProps {
  title: string;
  body: string;
}

/**
 * "Nothing to show yet" for a real analytics surface — as opposed to
 * `ComingSoonScreen`, which is for a feature that isn't built at all, this is
 * for one that is built but has no data behind it for this candidate yet.
 *
 * Shown in place of `SEED_DASHBOARD`'s fixture performance numbers
 * (`PerformanceOverviewCard`, `AnalysisScreen`) until a candidate has
 * actually sat a mock, so a brand-new account never mistakes the fixture's
 * sample stats for its own.
 */
export function EmptyAnalytics({ title, body }: EmptyAnalyticsProps) {
  return (
    <div className={styles.card}>
      <div className={styles.icon}>
        <DashboardIcon name="bar-chart-3" size={20} />
      </div>
      <p className={styles.title}>{title}</p>
      <p className={styles.body}>{body}</p>
    </div>
  );
}
