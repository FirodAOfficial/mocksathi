import type { PerformanceSnapshot as PerformanceSnapshotData } from '@/dashboard/types';
import styles from './PerformanceSnapshot.module.css';

export interface PerformanceSnapshotProps {
  performance: PerformanceSnapshotData;
}

/** The four KPI tiles at the top of the analysis section, mirrored from screen `1f`. */
export function PerformanceSnapshot({ performance }: PerformanceSnapshotProps) {
  return (
    <>
      <div className={styles.tile}>
        <div className={styles.label}>Average score</div>
        <div className={styles.valueRow}>
          <span className={styles.valueAccent}>{performance.averageScore.toFixed(1)}</span>
          <span className={styles.unit}>/ {performance.maxScore}</span>
        </div>
        <div className={styles.footUp}>↑ {performance.scoreDeltaVsLastWeek} marks vs last 7 days</div>
      </div>

      <div className={styles.tile}>
        <div className={styles.label}>Accuracy</div>
        <div className={styles.valueRow}>
          <span className={styles.value}>{performance.accuracyPct.toFixed(1)}%</span>
        </div>
        <div className={styles.footUp}>↑ {performance.accuracyDeltaPts} pts</div>
      </div>

      <div className={styles.tile}>
        <div className={styles.label}>Attempt rate</div>
        <div className={styles.valueRow}>
          <span className={styles.value}>{performance.attemptRatePct.toFixed(1)}%</span>
        </div>
        <div className={styles.foot}>{performance.attemptRatePct.toFixed(1)} of 100 questions</div>
      </div>

      <div className={styles.tile}>
        <div className={styles.label}>Best percentile</div>
        <div className={styles.valueRow}>
          <span className={styles.value}>{performance.bestPercentile}</span>
        </div>
        <div className={styles.foot}>
          Mock {performance.bestPercentileMockNumber} · rank #{performance.bestPercentileRank.toLocaleString('en-IN')}
        </div>
      </div>
    </>
  );
}
