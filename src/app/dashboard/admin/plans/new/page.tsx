import { requireAdmin } from '@/auth/cookies';
import headerStyles from '@/components/dashboard/AnalysisScreen.module.css';
import { PlanForm } from '@/components/dashboard/admin/PlanForm';

export default async function AddPlanPage() {
  await requireAdmin();

  return (
    <>
      <div className={headerStyles.header}>
        <h1 className={headerStyles.title}>Add Plan</h1>
        <p className={headerStyles.subtitle}>Define a new subscription tier.</p>
      </div>
      <PlanForm />
    </>
  );
}
