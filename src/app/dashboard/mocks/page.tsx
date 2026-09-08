import { requireUser } from '@/auth/cookies';
import { MocksTable } from '@/components/dashboard/MocksTable';
import { dashboardDataFor } from '@/dashboard/seedDashboard';

export default async function AllMocksPage() {
  const user = await requireUser();
  const data = dashboardDataFor(user);
  return <MocksTable heading="All Mocks (1–30)" mocks={data.allMocks} />;
}
