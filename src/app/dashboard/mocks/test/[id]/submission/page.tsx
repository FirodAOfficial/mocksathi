import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/auth/cookies';
import { ResultView } from '@/components/result/ResultView';
import headerStyles from '@/components/dashboard/AnalysisScreen.module.css';
import emptyStyles from '@/components/dashboard/ComingSoonScreen.module.css';
import { attemptFor } from '@/db/attempts';
import { attemptFromTest, getTestById, questionsForTest } from '@/db/tests';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const test = await getTestById(id);
  return { title: `${test?.name ?? 'Submission'} · MockSathi` };
}

/**
 * A candidate's own latest sitting of one authored paper.
 *
 * What "View Submission" on `/dashboard/mocks` opens (`MocksTable`). Renders
 * the same `ResultView` a live submission ends on, fed from the stored
 * `test_attempts` row instead of a fresh mark — "the latest score" is exactly
 * what `recordAttempt` (`src/db/attempts.ts`) keeps there, one row per
 * `(user, test)`.
 *
 * Addressed by the test's id, not its slug: a slug is regenerated when an
 * admin renames the paper (`updateTest`), which would otherwise turn a
 * reloaded or bookmarked submission link into a 404 for a paper that still
 * exists. The id never changes.
 */
export default async function TestSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const test = await getTestById(id);
  if (!test) notFound();

  const attempt = await attemptFor(user.id, test.id);
  if (!attempt) {
    return (
      <>
        <div className={headerStyles.header}>
          <h1 className={headerStyles.title}>{test.name}</h1>
          <p className={headerStyles.subtitle}>No submission yet</p>
        </div>
        <div className={emptyStyles.card}>
          <p className={emptyStyles.title}>Not attempted yet</p>
          <p className={emptyStyles.body}>
            You haven&apos;t sat this paper yet.{' '}
            <Link href={`/exam?subject=${test.subject}&test=${encodeURIComponent(test.slug)}`}>Start it</Link> to see
            your submission here.
          </p>
        </div>
      </>
    );
  }

  const questions = await questionsForTest(test.id);
  const examAttempt = attemptFromTest(test, questions, user.name);

  return (
    <ResultView
      result={attempt.result}
      attempt={examAttempt}
      language={attempt.language}
      backHref="/dashboard/mocks"
      attemptCount={attempt.attemptCount}
    />
  );
}
