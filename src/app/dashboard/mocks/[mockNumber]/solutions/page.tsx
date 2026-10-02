import { requireUser } from '@/auth/cookies';
import { ComingSoonScreen } from '@/components/dashboard/ComingSoonScreen';
import { dashboardDataFor } from '@/dashboard/seedDashboard';

export default async function MockSolutionsPage({ params }: { params: Promise<{ mockNumber: string }> }) {
  const { mockNumber } = await params;
  const user = await requireUser();
  const data = await dashboardDataFor(user);
  const mock = data.allMocks.find((entry) => entry.mockNumber === Number(mockNumber));

  return (
    <ComingSoonScreen
      icon="file-check-2"
      title={`Mock ${mockNumber} Solutions`}
      subtitle={mock ? `${mock.paperName} · ${mock.dateLabel}` : 'Question-by-question review'}
      note="Per-question review is planned here: your answer against the correct one, the explanation, and your timing against the cohort. Same detail as the sample exam's solutions screen at /result."
    />
  );
}
