import type { CurrentPlan } from '@/db/plans';
import type { DashboardData, MockSummary } from '@/dashboard/types';
import { fixtureMocksUsedCount } from '@/dashboard/seedDashboard';
import { DashboardMocksTable } from './DashboardMocksTable';
import styles from './DashboardScreen.module.css';
import { PerformanceOverviewCard } from './PerformanceOverviewCard';
import { PremiumBanner } from './PremiumBanner';

export interface DashboardScreenProps {
  data: DashboardData;
  /** Null before any default plan is configured — the performance card just omits the plan name then. */
  currentPlan: CurrentPlan | null;
  /**
   * The published papers, from `tests`.
   *
   * Passed in rather than read off `data`, which is still the fixture: the
   * mocks list is the one part of this screen that is real now, and mixing the
   * two sources inside `dashboardDataFor` would make it impossible to tell at a
   * glance which of the numbers on this page are true.
   */
  mocks: MockSummary[];
}

/**
 * The candidate's home screen.
 *
 * Redesigned from a reference mockup to cut the clutter of the original
 * layout (calendar preview, streak card, and challenge progress all above the
 * fold at once): a greeting, one performance summary, and the full mocks
 * list. The calendar/streak/challenge widgets this used to show still exist
 * at `/dashboard/calendar` — nothing was deleted, just moved off the page
 * that was trying to show everything at once.
 */
export function DashboardScreen({ data, currentPlan, mocks }: DashboardScreenProps) {
  const firstName = data.candidate.name.split(' ')[0];
  const completedMocks = fixtureMocksUsedCount(data);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Good Morning, {firstName} 👋</h1>
        <p className={styles.subtitle}>Practice today. A better tomorrow.</p>
      </div>

      <PerformanceOverviewCard
        performance={data.performance}
        mocksAttempted={completedMocks}
        planName={currentPlan?.plan.name ?? null}
      />

      <DashboardMocksTable mocks={mocks} />

      {currentPlan && !currentPlan.isSubscribed && (
        <PremiumBanner mocksUsed={completedMocks} mockLimit={currentPlan.plan.mockLimit} />
      )}
    </>
  );
}
