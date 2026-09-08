import { requireAdmin } from '@/auth/cookies';
import { ExamForm } from '@/components/dashboard/admin/ExamForm';
import headerStyles from '@/components/dashboard/AnalysisScreen.module.css';

export default async function AddExamPage() {
  await requireAdmin();

  return (
    <>
      <div className={headerStyles.header}>
        <h1 className={headerStyles.title}>Add Exam</h1>
        <p className={headerStyles.subtitle}>Everything a candidate needs to know before they register.</p>
      </div>
      <ExamForm />
    </>
  );
}
