import { requireUser } from '@/auth/cookies';
import { DashboardScreen } from '@/components/dashboard/DashboardScreen';
import { dashboardDataFor } from '@/dashboard/seedDashboard';
import { currentPlanForUser } from '@/db/plans';

/**
 * The candidate's dashboard home — see `sdd/dashboard.md` for the screens
 * planned to join it under this shell.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const [data, currentPlan] = await Promise.all([dashboardDataFor(user), currentPlanForUser(user.id)]);
  return <DashboardScreen data={data} currentPlan={currentPlan} />;
}
