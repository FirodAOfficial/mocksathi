import { notFound } from 'next/navigation';
import { requireAdmin } from '@/auth/cookies';
import headerStyles from '@/components/dashboard/AnalysisScreen.module.css';
import { PlanForm } from '@/components/dashboard/admin/PlanForm';
import { getPlanById } from '@/db/plans';

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const plan = await getPlanById(id);
  if (!plan) notFound();

  return (
    <>
      <div className={headerStyles.header}>
        <h1 className={headerStyles.title}>Edit Plan</h1>
        <p className={headerStyles.subtitle}>{plan.name}</p>
      </div>
      <PlanForm plan={plan} />
    </>
  );
}
