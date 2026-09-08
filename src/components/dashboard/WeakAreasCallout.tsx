import Link from 'next/link';
import type { WeakArea } from '@/dashboard/types';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './WeakAreasCallout.module.css';

export interface WeakAreasCalloutProps {
  weakAreas: WeakArea[];
}

export function WeakAreasCallout({ weakAreas }: WeakAreasCalloutProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <DashboardIcon name="trending-down" size={16} />
        <p className={styles.heading}>Weak areas to fix first</p>
      </div>

      <div className={styles.rows}>
        {weakAreas.map((area) => (
          <div key={area.topic} className={styles.row}>
            <div className={styles.topicBlock}>
              <div className={styles.topicRow}>
                <span className={styles.topic}>{area.topic}</span>
                <span className={styles[area.priority.toLowerCase()] ?? ''}>{area.priority}</span>
              </div>
              <span className={styles.meta}>
                {area.avgMarks} / {area.maxMarks} · {area.accuracyPct}% accuracy
              </span>
            </div>
            <Link href="/dashboard/practice" className={styles.action}>
              Practice
            </Link>
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <Link href="/dashboard/weak-areas" className={styles.footerLink}>
          See all weak &amp; strong areas →
        </Link>
      </div>
    </div>
  );
}
