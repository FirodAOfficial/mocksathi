import { requireUser } from '@/auth/cookies';
import { TodaysMockScreen } from '@/components/dashboard/TodaysMockScreen';
import { dashboardDataFor } from '@/dashboard/seedDashboard';

export default async function TodaysMockPage() {
  const user = await requireUser();
  const data = await dashboardDataFor(user);
  return <TodaysMockScreen todaysMock={data.todaysMock} />;
}
