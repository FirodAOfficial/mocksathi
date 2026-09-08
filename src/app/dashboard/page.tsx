import { DashboardScreen } from '@/components/dashboard/DashboardScreen';
import { SEED_DASHBOARD } from '@/dashboard/seedDashboard';

/**
 * The candidate's dashboard home — see `sdd/dashboard.md` for the screens
 * planned to join it under this shell.
 */
export default function DashboardPage() {
  return <DashboardScreen data={SEED_DASHBOARD} />;
}
