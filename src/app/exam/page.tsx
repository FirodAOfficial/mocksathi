import { PAPER } from '@/exam/result';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { isLanguage } from '@/exam/types';
import { InstructionsScreen } from '@/components/exam/InstructionsScreen';

/**
 * The instructions the candidate reads before the paper opens.
 *
 * A separate route rather than a first screen inside `/editor`, so the exam
 * shell only ever renders a paper that is already under way — it has a running
 * clock and an auto-submit, neither of which should start while someone is
 * still reading the rules.
 */
export default async function ExamInstructionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.lang) ? params.lang[0] : params.lang;

  return (
    <InstructionsScreen
      attempt={SEED_ATTEMPT}
      testName={PAPER.testName}
      maximumMarks={PAPER.maximumMarks}
      qualifyingMarks={PAPER.qualifyingMarks}
      initialLanguage={isLanguage(raw) ? raw : 'en'}
    />
  );
}
