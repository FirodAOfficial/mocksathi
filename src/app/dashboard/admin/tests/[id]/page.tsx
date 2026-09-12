import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/auth/cookies';
import { DeleteResource } from '@/components/dashboard/admin/DeleteResource';
import { TestQuestionsPanel } from '@/components/dashboard/admin/TestQuestionsPanel';
import styles from '@/components/dashboard/admin/TestWorkbench.module.css';
import { db } from '@/db/client';
import { exams } from '@/db/schema';
import { getTestById, paperIdentityFor, questionsForTest } from '@/db/tests';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const test = await getTestById(id);
  return { title: `${test?.name ?? 'Test'} · Test Enigma · MockSathi` };
}

const SUBJECT_LABEL = { word: 'Word', excel: 'Excel' } as const;

/** One paper's workbench: what it is, and every question in it. */
export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const test = await getTestById(id);
  if (!test) notFound();

  const [questions, [exam]] = await Promise.all([
    questionsForTest(test.id),
    db.select({ name: exams.name }).from(exams).where(eq(exams.id, test.examId)).limit(1),
  ]);

  const identity = paperIdentityFor(test, questions);

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <Link href="/dashboard/admin/tests" className={styles.backLink}>
            ← Test Enigma
          </Link>
          <h1 className={styles.title}>{test.name}</h1>
          <p className={styles.subtitle}>
            {SUBJECT_LABEL[test.subject]} paper for {exam?.name ?? 'an exam that no longer exists'} · {test.status}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/dashboard/admin/tests/${test.id}/edit`} className={styles.secondary}>
            Edit details
          </Link>
          {/* The questions cascade, so the confirmation counts them out loud
              and a paper with any of them has to be typed out. */}
          <DeleteResource
            endpoint={`/api/admin/tests/${test.id}`}
            redirectTo="/dashboard/admin/tests"
            label="Delete test"
            title={`Delete “${test.name}”?`}
            detail={
              questions.length === 0
                ? 'It has no questions yet, so nothing else goes with it. This cannot be undone.'
                : `Its ${questions.length} question${questions.length === 1 ? '' : 's'} — passages, sheets, solutions and all — are deleted with it. This cannot be undone.`
            }
            requireTyping={questions.length > 0}
          />
        </div>
      </div>

      <div className={styles.facts}>
        <div className={styles.fact}>
          <span className={styles.factLabel}>Questions</span>
          <span className={styles.factValue}>{questions.length}</span>
        </div>
        <div className={styles.fact}>
          <span className={styles.factLabel}>Total marks</span>
          {/* Summed from the questions, so it cannot go stale the way a typed-in total would. */}
          <span className={styles.factValue}>{questions.length === 0 ? '—' : identity.maximumMarks}</span>
        </div>
        <div className={styles.fact}>
          <span className={styles.factLabel}>Qualifying</span>
          <span className={styles.factValue}>{test.qualifyingMarks}</span>
        </div>
        <div className={styles.fact}>
          <span className={styles.factLabel}>Duration</span>
          <span className={styles.factValue}>{test.durationMinutes} min</span>
        </div>
        <div className={styles.fact}>
          <span className={styles.factLabel}>Section</span>
          <span className={styles.factValue}>{test.sectionName}</span>
        </div>
      </div>

      <TestQuestionsPanel test={test} questions={questions} />
    </>
  );
}
