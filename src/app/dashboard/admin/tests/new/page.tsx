import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/auth/cookies';
import headerStyles from '@/components/dashboard/AnalysisScreen.module.css';
import { TestForm } from '@/components/dashboard/admin/TestForm';
import { db } from '@/db/client';
import { exams } from '@/db/schema';

export const metadata = { title: 'New test · MockSathi' };

export default async function NewTestPage() {
  await requireAdmin();
  const options = await db.select({ id: exams.id, name: exams.name }).from(exams).orderBy(asc(exams.name));

  return (
    <>
      <div className={headerStyles.header}>
        <h1 className={headerStyles.title}>New Test</h1>
        <p className={headerStyles.subtitle}>One paper, belonging to one exam. Its questions come next.</p>
      </div>
      <TestForm exams={options} />
    </>
  );
}
