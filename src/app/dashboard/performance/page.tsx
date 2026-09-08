import { ComingSoonScreen } from '@/components/dashboard/ComingSoonScreen';

export default function PerformancePage() {
  return (
    <ComingSoonScreen
      icon="bar-chart-3"
      title="Performance"
      subtitle="Score and accuracy trend across every mock you've sat."
      note="A dedicated performance trend view — see Overall Analysis in the meantime for the current snapshot."
    />
  );
}
