import { requireAdmin } from '@/auth/cookies';
import { PlansListScreen } from '@/components/dashboard/admin/PlansListScreen';
import { listPlans } from '@/db/plans';

export default async function ManagePlansPage() {
  await requireAdmin();
  const plans = await listPlans();
  return <PlansListScreen plans={plans} />;
}
