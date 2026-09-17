import type { SubjectSnapshot } from '@/dashboard/types';
import { formatMinutesSeconds } from '@/dashboard/seedDashboard';
import styles from './SubjectSnapshotList.module.css';

export interface SubjectSnapshotListProps {
  subjects: SubjectSnapshot[];
}

export function SubjectSnapshotList({ subjects }: SubjectSnapshotListProps) {
  // Real snapshots (`src/dashboard/realAnalysis.ts`) carry no benchmark — no
  // cross-candidate cohort exists to compute a top-10% figure from. Shown
  // only when at least one row actually has one, same reasoning as the
  // per-row marker below.
  const hasBenchmark = subjects.some((subject) => subject.benchmarkPct !== undefined);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <p className={styles.heading}>Subject analysis</p>
        <span className={styles.headerNote}>average across your mocks</span>
      </div>

      <div className={styles.rows}>
        {subjects.map((subject) => {
          const fillPct = (subject.avgMarks / subject.maxMarks) * 100;
          return (
            <div key={subject.subject}>
              <div className={styles.rowHead}>
                <span className={styles.subject}>
                  <span className={styles.dot} style={{ background: subject.color }} />
                  {subject.subject}
                </span>
                <span className={styles.stats}>
                  avg <b>{subject.avgMarks}</b> / {subject.maxMarks} · acc <b>{subject.accuracyPct}%</b> ·{' '}
                  <b>{formatMinutesSeconds(subject.avgTimeSeconds)}</b>/section
                </span>
              </div>
              <div className={styles.track}>
                <div className={styles.fill} style={{ width: `${fillPct}%`, background: subject.color }} />
                {subject.benchmarkPct !== undefined && (
                  <div className={styles.benchmark} style={{ left: `${subject.benchmarkPct}%` }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasBenchmark && (
        <div className={styles.footer}>
          <span className={styles.footerMark} />
          Marker shows the top 10% benchmark for that subject
        </div>
      )}
    </div>
  );
}
