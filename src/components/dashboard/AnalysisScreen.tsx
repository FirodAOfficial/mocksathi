import type { PerformanceSnapshot as PerformanceSnapshotData, SubjectSnapshot } from '@/dashboard/types';
import styles from './AnalysisScreen.module.css';
import { PerformanceSnapshot } from './PerformanceSnapshot';
import { SubjectSnapshotList } from './SubjectSnapshotList';

export interface AnalysisScreenProps {
  performance: PerformanceSnapshotData;
  subjects: SubjectSnapshot[];
}

/** Overall Analysis: the KPI tiles and subject breakdown also shown on the dashboard home, as their own page. */
export function AnalysisScreen({ performance, subjects }: AnalysisScreenProps) {
  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Overall Analysis</h1>
        <p className={styles.subtitle}>Score, accuracy and attempt rate across your recent mocks.</p>
      </div>

      <div className={styles.kpiRow}>
        <PerformanceSnapshot performance={performance} />
      </div>

      <SubjectSnapshotList subjects={subjects} />
    </>
  );
}
