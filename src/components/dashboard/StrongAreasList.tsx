import type { StrongArea } from '@/dashboard/types';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './StrongAreasList.module.css';

export interface StrongAreasListProps {
  strongAreas: StrongArea[];
}

export function StrongAreasList({ strongAreas }: StrongAreasListProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <DashboardIcon name="star" size={16} />
        <p className={styles.heading}>Strong areas</p>
      </div>

      <div className={styles.rows}>
        {strongAreas.map((area) => (
          <div key={area.topic} className={styles.row}>
            <span className={styles.topic}>{area.topic}</span>
            <span className={styles.meter}>
              <span className={styles.track}>
                <span className={styles.fill} style={{ width: `${area.masteryPct}%` }} />
              </span>
              <b className={styles.pct}>{area.masteryPct}%</b>
            </span>
          </div>
        ))}
      </div>

      <p className={styles.footer}>Keep these warm with one timed quiz a week — no full revision needed.</p>
    </div>
  );
}
