import type { Metadata } from 'next';
import { requireVerifiedUser } from '@/auth/cookies';
import { fixtureFor, type ResultOutcome } from '@/exam/result';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { ResultView } from '@/components/result/ResultView';

export const metadata: Metadata = {
  title: 'Result',
  // Behind a login; a crawler only ever reaches the redirect to /login.
  robots: { index: false, follow: false },
};

/**
 * Design preview for the two result screens.
 *
 * `/result?outcome=qualified` and `/result?outcome=not-qualified` render the
 * approved figures directly, so either screen can be opened and iterated on
 * without sitting a paper. The live screen after a submission uses the same
 * component with a real `ExamResult`.
 */
export default async function ResultPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireVerifiedUser();
  const params = await searchParams;
  const raw = Array.isArray(params.outcome) ? params.outcome[0] : params.outcome;
  const outcome: ResultOutcome = raw === 'not-qualified' ? 'not-qualified' : 'qualified';

  return <ResultView result={fixtureFor(outcome)} attempt={SEED_ATTEMPT} language="en" backHref="/" />;
}
