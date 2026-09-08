import type { MockCalendarDay, MockCalendarDayStatus } from '@/dashboard/types';
import styles from './MockCalendarPreview.module.css';

export interface MockCalendarPreviewProps {
  monthLabel: string;
  challengeDayLabel: string;
  days: MockCalendarDay[];
}

const LEGEND: { status: MockCalendarDayStatus; label: string; swatch: string }[] = [
  { status: 'attempted', label: 'Attempted', swatch: '#16a34a' },
  { status: 'missed', label: 'Missed', swatch: '#dc2626' },
  { status: 'today', label: 'Today', swatch: '#1c6ef2' },
  { status: 'locked', label: 'Locked', swatch: '#cbd5e1' },
];

export function MockCalendarPreview({ monthLabel, challengeDayLabel, days }: MockCalendarPreviewProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.heading}>{monthLabel}</p>
          <p className={styles.subheading}>{challengeDayLabel}</p>
        </div>
      </div>

      <div className={styles.weekdays}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {days.map((entry) => (
          <div key={entry.day} className={`${styles.cell} ${styles[entry.status] ?? ''}`}>
            <div className={styles.cellDay}>{entry.day}</div>
            {(entry.mockLabel || entry.note) && (
              <div className={styles.cellNote}>
                {entry.mockLabel}
                {entry.mockLabel && entry.note ? ' · ' : ''}
                {entry.note}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.legend}>
        {LEGEND.map((item) => (
          <span key={item.status} className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: item.swatch }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
