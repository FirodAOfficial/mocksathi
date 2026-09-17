import type { PerformanceSnapshot as PerformanceSnapshotData } from '@/dashboard/types';
import styles from './PerformanceSnapshot.module.css';

export interface PerformanceSnapshotProps {
  performance: PerformanceSnapshotData;
  /**
   * Real count of papers sat — the last tile's fallback content when there is
   * no `bestPercentile` to show (real data never has one; see `types.ts`).
   */
  mocksAttempted: number;
}

/**
 * The four KPI tiles at the top of the analysis section, mirrored from
 * screen `1f`, adapted for real data: the trend deltas and the
 * percentile/rank tile only render when the snapshot actually carries them
 * (the design fixtures do; a real, `test_attempts`-derived snapshot doesn't
 * — see `PerformanceSnapshot` in `types.ts`) — the last tile falls back to a
 * real figure, mocks attempted, rather than a blank or an invented one.
 */
export function PerformanceSnapshot({ performance, mocksAttempted }: PerformanceSnapshotProps) {
  return (
    <>
      <div className={styles.tile}>
        <div className={styles.label}>Average score</div>
        <div className={styles.valueRow}>
          <span className={styles.valueAccent}>{performance.averageScore.toFixed(1)}%</span>
        </div>
        {performance.scoreDeltaVsLastWeek !== undefined && (
          <div className={styles.footUp}>↑ {performance.scoreDeltaVsLastWeek} marks vs last 7 days</div>
        )}
      </div>

      <div className={styles.tile}>
        <div className={styles.label}>Accuracy</div>
        <div className={styles.valueRow}>
          <span className={styles.value}>{performance.accuracyPct.toFixed(1)}%</span>
        </div>
        {performance.accuracyDeltaPts !== undefined && (
          <div className={styles.footUp}>↑ {performance.accuracyDeltaPts} pts</div>
        )}
      </div>

      <div className={styles.tile}>
        <div className={styles.label}>Attempt rate</div>
        <div className={styles.valueRow}>
          <span className={styles.value}>{performance.attemptRatePct.toFixed(1)}%</span>
        </div>
        <div className={styles.foot}>of questions attempted, not skipped</div>
      </div>

      {performance.bestPercentile !== undefined &&
      performance.bestPercentileMockNumber !== undefined &&
      performance.bestPercentileRank !== undefined ? (
        <div className={styles.tile}>
          <div className={styles.label}>Best percentile</div>
          <div className={styles.valueRow}>
            <span className={styles.value}>{performance.bestPercentile}</span>
          </div>
          <div className={styles.foot}>
            Mock {performance.bestPercentileMockNumber} · rank #
            {performance.bestPercentileRank.toLocaleString('en-IN')}
          </div>
        </div>
      ) : (
        <div className={styles.tile}>
          <div className={styles.label}>Mocks attempted</div>
          <div className={styles.valueRow}>
            <span className={styles.value}>{mocksAttempted}</span>
          </div>
          <div className={styles.foot}>total papers sat so far</div>
        </div>
      )}
    </>
  );
}
