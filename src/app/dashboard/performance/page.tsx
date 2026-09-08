import { requireUser } from '@/auth/cookies';
import { AnalysisScreen } from '@/components/dashboard/AnalysisScreen';
import { dashboardDataFor } from '@/dashboard/seedDashboard';

export default async function PerformancePage() {
  const user = await requireUser();
  const data = await dashboardDataFor(user);

  return (
    <AnalysisScreen
      performance={data.performance}
      subjects={data.subjects}
      title="Performance"
      subtitle="Score, accuracy and attempt rate across your recent mocks."
    />
  );
}
