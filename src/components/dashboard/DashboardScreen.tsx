import Link from 'next/link';
import type { DashboardData } from '@/dashboard/types';
import { ChallengeProgressCard } from './ChallengeProgressCard';
import styles from './DashboardScreen.module.css';
import mocksTableStyles from './MocksTable.module.css';
import { MockCalendarPreview } from './MockCalendarPreview';
import { MocksTable } from './MocksTable';
import { PerformanceSnapshot } from './PerformanceSnapshot';
import { StreakCard } from './StreakCard';

export interface DashboardScreenProps {
  data: DashboardData;
}

/**
 * The candidate's home screen: today's mock, streak, calendar, and a snapshot
 * of performance pulled from the analysis and weak-areas screens planned for
 * later (`sdd/dashboard.md` Phase 5) — enough to act on without leaving here.
 */
export function DashboardScreen({ data }: DashboardScreenProps) {
  const firstName = data.candidate.name.split(' ')[0];
  const primaryExam = data.enrollments.find((enrollment) => enrollment.isPrimary);
  const completedMocks = data.calendarDays.filter((day) => day.status === 'attempted').length;

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Welcome back, {firstName}</h1>
          <p className={styles.subtitle}>
            {primaryExam?.examName} · {completedMocks} mocks attempted this month · streak day{' '}
            {data.streak.currentStreakDays}
          </p>
        </div>
      </div>

      <div className={styles.topRow}>
        <MockCalendarPreview
          monthLabel={data.calendarMonthLabel}
          challengeDayLabel={`${data.challenge.name} · day ${data.challenge.completedDays} of ${data.challenge.totalDays}`}
          days={data.calendarDays}
        />
        <div className={styles.sideStack}>
          <StreakCard streak={data.streak} todaysMock={data.todaysMock} />
          <ChallengeProgressCard challenge={data.challenge} />
        </div>
      </div>

      <div className={styles.kpiRow}>
        <PerformanceSnapshot performance={data.performance} />
      </div>

      <MocksTable
        heading="Recent mocks"
        mocks={[data.todaysMock, ...data.recentMocks]}
        headerRight={
          <Link href="/dashboard/mocks" className={mocksTableStyles.viewAll}>
            View all mocks (1–30) →
          </Link>
        }
      />
    </>
  );
}
