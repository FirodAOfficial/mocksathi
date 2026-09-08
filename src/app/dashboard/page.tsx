import { requireUser } from '@/auth/cookies';
import { DashboardScreen } from '@/components/dashboard/DashboardScreen';
import { dashboardDataFor } from '@/dashboard/seedDashboard';

/**
 * The candidate's dashboard home — see `sdd/dashboard.md` for the screens
 * planned to join it under this shell.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  return <DashboardScreen data={dashboardDataFor(user)} />;
}
