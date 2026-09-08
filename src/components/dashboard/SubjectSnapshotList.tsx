import type { SubjectSnapshot } from '@/dashboard/types';
import { formatMinutesSeconds } from '@/dashboard/seedDashboard';
import styles from './SubjectSnapshotList.module.css';

export interface SubjectSnapshotListProps {
  subjects: SubjectSnapshot[];
}

export function SubjectSnapshotList({ subjects }: SubjectSnapshotListProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <p className={styles.heading}>Subject analysis</p>
        <span className={styles.headerNote}>average of last 10 mocks</span>
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
                <div className={styles.benchmark} style={{ left: `${subject.benchmarkPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <span className={styles.footerMark} />
        Marker shows the top 10% benchmark for that subject
      </div>
    </div>
  );
}
