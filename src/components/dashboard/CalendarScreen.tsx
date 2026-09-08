import type { ChallengePlan, MockCalendarDay, MockSummary, StreakState } from '@/dashboard/types';
import { ChallengeProgressCard } from './ChallengeProgressCard';
import styles from './CalendarScreen.module.css';
import { MockCalendarPreview } from './MockCalendarPreview';
import { StreakCard } from './StreakCard';

export interface CalendarScreenProps {
  monthLabel: string;
  challenge: ChallengePlan;
  days: MockCalendarDay[];
  streak: StreakState;
  todaysMock: MockSummary;
}

export function CalendarScreen({ monthLabel, challenge, days, streak, todaysMock }: CalendarScreenProps) {
  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Mock Calendar</h1>
        <p className={styles.subtitle}>{challenge.name} — day {challenge.completedDays} of {challenge.totalDays}</p>
      </div>

      <div className={styles.row}>
        <MockCalendarPreview
          monthLabel={monthLabel}
          challengeDayLabel={`${challenge.name} · day ${challenge.completedDays} of ${challenge.totalDays}`}
          days={days}
        />
        <div className={styles.sideStack}>
          <StreakCard streak={streak} todaysMock={todaysMock} />
          <ChallengeProgressCard challenge={challenge} />
        </div>
      </div>
    </>
  );
}
