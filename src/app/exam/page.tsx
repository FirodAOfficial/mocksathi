import { requireVerifiedUser } from '@/auth/cookies';
import { EXCEL_PAPER, PAPER } from '@/exam/result';
import { EXCEL_SEED_ATTEMPT } from '@/exam/excelSeedAttempt';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { isLanguage } from '@/exam/types';
import { InstructionsScreen } from '@/components/exam/InstructionsScreen';
import type { Metadata } from 'next';

/** The tab says which paper is about to be sat, not just "Editor". */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const subject = Array.isArray(params.subject) ? params.subject[0] : params.subject;

  // Bare title: the root layout's template appends the site name. Not indexed
  // — the paper itself is behind a login.
  return {
    title: subject === 'excel' ? EXCEL_PAPER.testName : PAPER.testName,
    robots: { index: false, follow: false },
  };
}

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
  await requireVerifiedUser();
  const params = await searchParams;
  const raw = Array.isArray(params.lang) ? params.lang[0] : params.lang;
  const subject = Array.isArray(params.subject) ? params.subject[0] : params.subject;

  // Anything other than `excel` is the Word paper, which is what a bare `/exam`
  // has always meant and what every existing link points at.
  const excel = subject === 'excel';
  const attempt = excel ? EXCEL_SEED_ATTEMPT : SEED_ATTEMPT;
  const paper = excel ? EXCEL_PAPER : PAPER;

  return (
    <InstructionsScreen
      attempt={attempt}
      testName={paper.testName}
      maximumMarks={paper.maximumMarks}
      qualifyingMarks={paper.qualifyingMarks}
      initialLanguage={isLanguage(raw) ? raw : 'en'}
    />
  );
}
