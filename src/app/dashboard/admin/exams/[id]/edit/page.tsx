import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/auth/cookies';
import headerStyles from '@/components/dashboard/AnalysisScreen.module.css';
import { ExamForm } from '@/components/dashboard/admin/ExamForm';
import { db } from '@/db/client';
import { exams } from '@/db/schema';

export default async function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [exam] = await db.select().from(exams).where(eq(exams.id, id)).limit(1);
  if (!exam) notFound();

  return (
    <>
      <div className={headerStyles.header}>
        <h1 className={headerStyles.title}>Edit Exam</h1>
        <p className={headerStyles.subtitle}>{exam.name}</p>
      </div>
      <ExamForm exam={exam} />
    </>
  );
}
