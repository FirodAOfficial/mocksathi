import { asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/auth/cookies';
import headerStyles from '@/components/dashboard/AnalysisScreen.module.css';
import { TestForm } from '@/components/dashboard/admin/TestForm';
import { db } from '@/db/client';
import { exams } from '@/db/schema';
import { getTestById, questionsForTest } from '@/db/tests';

export default async function EditTestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const test = await getTestById(id);
  if (!test) notFound();

  const [options, questions] = await Promise.all([
    db.select({ id: exams.id, name: exams.name }).from(exams).orderBy(asc(exams.name)),
    questionsForTest(test.id),
  ]);

  return (
    <>
      <div className={headerStyles.header}>
        <h1 className={headerStyles.title}>Edit Test</h1>
        <p className={headerStyles.subtitle}>{test.name}</p>
      </div>
      {/* Once a paper has questions its application is fixed — every question
          holds either a passage or a sheet, and the two shells are not
          interchangeable. The form greys the picker out and says why. */}
      <TestForm exams={options} test={test} hasQuestions={questions.length > 0} />
    </>
  );
}
