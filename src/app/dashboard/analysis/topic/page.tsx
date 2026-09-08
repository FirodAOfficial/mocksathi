import { ComingSoonScreen } from '@/components/dashboard/ComingSoonScreen';

export default function TopicAnalysisPage() {
  return (
    <ComingSoonScreen
      icon="git-branch"
      title="Topic Analysis"
      subtitle="Accuracy and attempts down to individual topics."
      note="A topic-level breakdown across all 48 tracked topics — see Weak Areas in the meantime for the ones costing you the most marks."
    />
  );
}
