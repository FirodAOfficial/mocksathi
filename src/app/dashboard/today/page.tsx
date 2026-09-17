import { requireUser } from '@/auth/cookies';
import { TodaysMockScreen } from '@/components/dashboard/TodaysMockScreen';
import { dashboardDataFor } from '@/dashboard/seedDashboard';
import { mockLimitStatusForUser } from '@/dashboard/mockLimit';

export default async function TodaysMockPage() {
  const user = await requireUser();
  const [data, limitStatus] = await Promise.all([dashboardDataFor(user), mockLimitStatusForUser(user.id)]);

  // The next Excel paper the candidate has not already sat, shown beside the
  // Word one so both skills are visible from the same screen.
  const excelMock = data.allMocks.find((mock) => mock.mockType === 'excel' && mock.state !== 'done');

  return (
    <TodaysMockScreen
      todaysMock={data.todaysMock}
      excelMock={excelMock}
      limitReached={limitStatus.limitReached}
    />
  );
}
