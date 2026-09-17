import { requireUser } from '@/auth/cookies';
import { DashboardScreen } from '@/components/dashboard/DashboardScreen';
import { dashboardDataFor } from '@/dashboard/seedDashboard';
import { mockLimitStatusForUser } from '@/dashboard/mockLimit';
import { currentPlanForUser } from '@/db/plans';
import { publishedTestRows } from '@/db/tests';

/**
 * The candidate's dashboard home — see `sdd/dashboard.md` for the screens
 * planned to join it under this shell.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [data, currentPlan, mocks, limitStatus, params] = await Promise.all([
    dashboardDataFor(user),
    currentPlanForUser(user.id),
    publishedTestRows(user.id),
    mockLimitStatusForUser(user.id),
    searchParams,
  ]);

  return (
    <DashboardScreen
      data={data}
      currentPlan={currentPlan}
      mocks={mocks}
      mocksAttempted={limitStatus.mocksUsed}
      mockLimitReached={limitStatus.limitReached}
      // Set only when `/exam` bounced a direct visit back here for trying to
      // start a new mock past the limit — see `src/app/exam/page.tsx`.
      showLimitReachedModal={params.limitReached === '1'}
    />
  );
}
