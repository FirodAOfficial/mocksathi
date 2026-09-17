import { requireUser } from '@/auth/cookies';
import { AnalysisScreen } from '@/components/dashboard/AnalysisScreen';
import { dashboardDataFor } from '@/dashboard/seedDashboard';
import { attemptedTestCountForUser } from '@/db/attempts';

export default async function PerformancePage() {
  const user = await requireUser();
  const [data, mocksAttempted] = await Promise.all([dashboardDataFor(user), attemptedTestCountForUser(user.id)]);

  return (
    <AnalysisScreen
      performance={data.performance}
      subjects={data.subjects}
      title="Performance"
      subtitle="Score, accuracy and attempt rate across your recent mocks."
      mocksAttempted={mocksAttempted}
    />
  );
}
