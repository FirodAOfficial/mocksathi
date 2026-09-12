import { getCurrentUser, requireUser } from '@/auth/cookies';
import { paperFor } from '@/db/tests';
import { EXCEL_PAPER, PAPER } from '@/exam/result';
import { EXCEL_SEED_ATTEMPT } from '@/exam/excelSeedAttempt';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { isLanguage, type ExamAttempt } from '@/exam/types';
import { InstructionsScreen } from '@/components/exam/InstructionsScreen';
import type { Metadata } from 'next';

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/** The tab says which paper is about to be sat, not just "Editor". */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const subject = first(params.subject) === 'excel' ? 'excel' : 'word';
  const paper = await paperFor({ slug: first(params.test), subject });

  return { title: `${paper?.identity.testName ?? (subject === 'excel' ? EXCEL_PAPER.testName : PAPER.testName)} · MockSathi` };
}

/**
 * The instructions the candidate reads before the paper opens.
 *
 * A separate route rather than a first screen inside `/editor`, so the exam
 * shell only ever renders a paper that is already under way — it has a running
 * clock and an auto-submit, neither of which should start while someone is
 * still reading the rules.
 *
 * **Where the paper comes from.** `?test=<slug>` names one; otherwise it is
 * today's, which is the oldest published test of the requested subject
 * (`todaysTest`). If neither exists — a fresh database with nothing authored —
 * the sample paper in `src/exam/seedAttempt.ts` stands in, so this page works
 * before an admin has written anything. Which of the two it was does not reach
 * any component below: both arrive as an ordinary `ExamAttempt`.
 */
export default async function ExamInstructionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const raw = first(params.lang);

  // Anything other than `excel` is the Word paper, which is what a bare `/exam`
  // has always meant and what every existing link points at.
  const subject = first(params.subject) === 'excel' ? 'excel' : 'word';

  const user = await getCurrentUser();
  const paper = await paperFor({ slug: first(params.test), subject }, user?.name);

  const fallbackAttempt: ExamAttempt = subject === 'excel' ? EXCEL_SEED_ATTEMPT : SEED_ATTEMPT;
  const fallbackIdentity = subject === 'excel' ? EXCEL_PAPER : PAPER;

  return (
    <InstructionsScreen
      attempt={paper?.attempt ?? fallbackAttempt}
      testName={paper?.identity.testName ?? fallbackIdentity.testName}
      maximumMarks={paper?.identity.maximumMarks ?? fallbackIdentity.maximumMarks}
      qualifyingMarks={paper?.identity.qualifyingMarks ?? fallbackIdentity.qualifyingMarks}
      // Carried onward so the shell opens the same paper these figures describe,
      // rather than resolving "today's" a second time and possibly differently.
      testSlug={paper?.slug ?? null}
      initialLanguage={isLanguage(raw) ? raw : 'en'}
    />
  );
}
