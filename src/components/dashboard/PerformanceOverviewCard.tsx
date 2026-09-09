import Link from 'next/link';
import type { PerformanceSnapshot } from '@/dashboard/types';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './PerformanceOverviewCard.module.css';

export interface PerformanceOverviewCardProps {
  performance: PerformanceSnapshot;
  mocksAttempted: number;
  /** e.g. "Free Plan", "1 Year" — omitted (and the parenthetical dropped) if no plan is configured yet. */
  planName: string | null;
}

/**
 * The dashboard home's single performance summary — four tiles instead of the
 * detailed page's full breakdown (`AnalysisScreen`/`PerformanceSnapshot`),
 * with a link out to that page for anyone who wants more than a glance.
 */
export function PerformanceOverviewCard({ performance, mocksAttempted, planName }: PerformanceOverviewCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Your Performance</h2>
          <p className={styles.subtitle}>
            Based on {mocksAttempted} attempted mock{mocksAttempted === 1 ? '' : 's'}
            {planName ? ` (${planName})` : ''}
          </p>
        </div>
        <Link href="/dashboard/performance" className={styles.link}>
          View Detailed Analysis
          <DashboardIcon name="arrow-right" size={14} />
        </Link>
      </div>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={`${styles.iconBadge} ${styles.iconBlue}`}>
            <DashboardIcon name="trophy" size={20} />
          </div>
          <div>
            <div className={styles.value}>
              {Math.round((performance.averageScore / performance.maxScore) * 100)}%
            </div>
            <div className={styles.label}>
              Average Score
              <span className={styles.labelDetail}>
                ({performance.averageScore.toFixed(0)} / {performance.maxScore})
              </span>
            </div>
          </div>
        </div>

        <div className={styles.tile}>
          <div className={`${styles.iconBadge} ${styles.iconGreen}`}>
            <DashboardIcon name="target" size={20} />
          </div>
          <div>
            <div className={styles.value}>{performance.accuracyPct.toFixed(0)}%</div>
            <div className={styles.label}>Accuracy</div>
          </div>
        </div>

        <div className={styles.tile}>
          <div className={`${styles.iconBadge} ${styles.iconOrange}`}>
            <DashboardIcon name="clock" size={20} />
          </div>
          <div>
            <div className={styles.value}>{performance.avgTimePerQuestionSeconds} sec</div>
            <div className={styles.label}>Avg. Time per Question</div>
          </div>
        </div>

        <div className={styles.tile}>
          <div className={`${styles.iconBadge} ${styles.iconPurple}`}>
            <DashboardIcon name="bar-chart-3" size={20} />
          </div>
          <div>
            <div className={styles.value}>{mocksAttempted}</div>
            <div className={styles.label}>Mocks Attempted</div>
          </div>
        </div>
      </div>
    </div>
  );
}
