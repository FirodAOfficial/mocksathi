import { requireUser } from '@/auth/cookies';
import { AnalysisScreen } from '@/components/dashboard/AnalysisScreen';
import { dashboardDataFor } from '@/dashboard/seedDashboard';

export default async function OverallAnalysisPage() {
  const user = await requireUser();
  const data = dashboardDataFor(user);
  return <AnalysisScreen performance={data.performance} subjects={data.subjects} />;
}
