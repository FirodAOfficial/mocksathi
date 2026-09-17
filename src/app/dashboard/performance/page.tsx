import { requireUser } from '@/auth/cookies';
import { AnalysisScreen } from '@/components/dashboard/AnalysisScreen';
import { realAnalysisForUser } from '@/dashboard/realAnalysis';

export default async function PerformancePage() {
  const user = await requireUser();
  const analysis = await realAnalysisForUser(user.id);

  return (
    <AnalysisScreen
      performance={analysis.performance}
      subjects={analysis.subjects}
      title="Performance"
      subtitle="Score, accuracy and attempt rate across your recent mocks."
      mocksAttempted={analysis.mocksAttempted}
    />
  );
}
