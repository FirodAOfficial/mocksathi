import type { PerformanceSnapshot as PerformanceSnapshotData, SubjectSnapshot } from '@/dashboard/types';
import styles from './AnalysisScreen.module.css';
import { PerformanceSnapshot } from './PerformanceSnapshot';
import { SubjectSnapshotList } from './SubjectSnapshotList';

export interface AnalysisScreenProps {
  performance: PerformanceSnapshotData;
  subjects: SubjectSnapshot[];
  title?: string;
  subtitle?: string;
}

/**
 * The KPI tiles and subject breakdown also shown on the dashboard home, as
 * their own page — lives at `/dashboard/performance` (the simplified
 * student menu's "Performance" item, and the same route as the full menu's
 * "Performance" under Mocks), title/subtitle overridable for either.
 */
export function AnalysisScreen({
  performance,
  subjects,
  title = 'Overall Analysis',
  subtitle = 'Score, accuracy and attempt rate across your recent mocks.',
}: AnalysisScreenProps) {
  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>

      <div className={styles.kpiRow}>
        <PerformanceSnapshot performance={performance} />
      </div>

      <SubjectSnapshotList subjects={subjects} />
    </>
  );
}
