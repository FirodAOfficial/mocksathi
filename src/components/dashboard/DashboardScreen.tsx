import type { CurrentPlan } from '@/db/plans';
import type { DashboardData, MockSummary } from '@/dashboard/types';
import { DashboardMocksTable } from './DashboardMocksTable';
import styles from './DashboardScreen.module.css';
import { LimitReachedNotice } from './LimitReachedNotice';
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
  /** Distinct papers this candidate has actually sat — real, from `test_attempts`, not the fixture calendar. */
  mocksAttempted: number;
  /** True once an unsubscribed candidate has used every mock their plan allows — gates "Start Mock" in `DashboardMocksTable`. */
  mockLimitReached: boolean;
  /**
   * Opens the same limit-reached modal on load — set when `/exam` redirected
   * here because a direct visit tried to start a new mock past the limit.
   */
  showLimitReachedModal?: boolean;
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
export function DashboardScreen({
  data,
  currentPlan,
  mocks,
  mocksAttempted,
  mockLimitReached,
  showLimitReachedModal = false,
}: DashboardScreenProps) {
  const firstName = data.candidate.name.split(' ')[0];

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Good Morning, {firstName} 👋</h1>
        <p className={styles.subtitle}>Practice today. A better tomorrow.</p>
      </div>

      <PerformanceOverviewCard
        performance={data.performance}
        mocksAttempted={mocksAttempted}
        planName={currentPlan?.plan.name ?? null}
      />

      <DashboardMocksTable mocks={mocks} limitReached={mockLimitReached} />

      {currentPlan && !currentPlan.isSubscribed && (
        <PremiumBanner mocksUsed={mocksAttempted} mockLimit={currentPlan.plan.mockLimit} />
      )}

      {showLimitReachedModal && <LimitReachedNotice />}
    </>
  );
}
