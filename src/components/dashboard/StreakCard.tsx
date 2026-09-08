import Link from 'next/link';
import type { MockSummary, StreakState } from '@/dashboard/types';
import { streakLockCountdownLabel } from '@/dashboard/seedDashboard';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './StreakCard.module.css';

export interface StreakCardProps {
  streak: StreakState;
  todaysMock: MockSummary;
}

export function StreakCard({ streak, todaysMock }: StreakCardProps) {
  const countdown = streakLockCountdownLabel(streak.lockHour, new Date());
  const lockTimeLabel = new Date(2000, 0, 1, streak.lockHour).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <div className={styles.flameRing}>
          <DashboardIcon name="flame" size={28} />
        </div>
        <div>
          <p className={styles.heading}>{streak.currentStreakDays} day streak</p>
          <p className={styles.note}>
            One missed day on {streak.lastMissedDate} reset your streak run. Today&apos;s mock keeps it alive.
          </p>
        </div>
      </div>

      <div className={styles.lockRow}>
        <span className={styles.lockLabel}>
          <DashboardIcon name="lock" size={14} />
          Streak locks at {lockTimeLabel}
        </span>
        <b className={styles.lockCountdown}>{countdown}</b>
      </div>

      <Link href="/dashboard/today" className={styles.cta}>
        Start Mock {todaysMock.mockNumber}
        <DashboardIcon name="arrow-right" size={15} />
      </Link>
    </div>
  );
}
