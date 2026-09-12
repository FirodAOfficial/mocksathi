import { count, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/auth/cookies';
import headerStyles from '@/components/dashboard/AnalysisScreen.module.css';
import { DeleteResource } from '@/components/dashboard/admin/DeleteResource';
import { ExamForm } from '@/components/dashboard/admin/ExamForm';
import { db } from '@/db/client';
import { enrollments, exams, tests } from '@/db/schema';

export default async function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [exam] = await db.select().from(exams).where(eq(exams.id, id)).limit(1);
  if (!exam) notFound();

  // What deleting it would take with it. Both cascade, so the admin is told
  // the count before pressing anything, and the route refuses independently.
  const [[papers], [registrations]] = await Promise.all([
    db.select({ total: count() }).from(tests).where(eq(tests.examId, id)),
    db.select({ total: count() }).from(enrollments).where(eq(enrollments.examId, id)),
  ]);

  const dependents = [
    (papers?.total ?? 0) > 0 ? `${papers!.total} test${papers!.total === 1 ? '' : 's'}` : null,
    (registrations?.total ?? 0) > 0
      ? `${registrations!.total} candidate registration${registrations!.total === 1 ? '' : 's'}`
      : null,
  ].filter((entry) => entry !== null);

  return (
    <>
      <div className={headerStyles.header}>
        <h1 className={headerStyles.title}>Edit Exam</h1>
        <p className={headerStyles.subtitle}>{exam.name}</p>
      </div>
      <ExamForm exam={exam} />

      <div className={headerStyles.header} style={{ marginTop: 28 }}>
        <h2 className={headerStyles.title} style={{ fontSize: 15 }}>
          Delete this exam
        </h2>
        <p className={headerStyles.subtitle}>
          {dependents.length > 0
            ? `Not while it has ${dependents.join(' and ')}. Set its status to Archived instead — that hides the listing and keeps everything.`
            : 'Nothing depends on this exam, so it can be removed. For an exam that has already run, prefer Archived.'}
        </p>
      </div>
      <DeleteResource
        endpoint={`/api/admin/exams/${exam.id}`}
        redirectTo="/dashboard/admin/exams"
        label="Delete exam"
        title={`Delete “${exam.name}”?`}
        detail={
          dependents.length > 0
            ? `This will be refused: ${dependents.join(' and ')} still point at it, and they would be deleted with it.`
            : 'No tests and no candidate registrations point at it. This cannot be undone.'
        }
        requireTyping
      />
    </>
  );
}
