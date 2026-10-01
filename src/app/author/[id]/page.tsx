import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/auth/cookies';
import { DocumentAuthoringShell, type AuthoringQuestion } from '@/components/authoring/DocumentAuthoringShell';
import { getDocumentPaper } from '@/db/documentPapers';
import { getTestById, questionsForTest } from '@/db/tests';

export const metadata: Metadata = {
  title: 'Write a paper',
  robots: { index: false, follow: false },
};

/**
 * `/author/<test id>` — writing a single-document Word paper.
 *
 * Outside `/dashboard` so it gets the whole screen, like `/editor`: the admin is
 * working in the same Word chrome a candidate sits the paper in. Admin-only
 * here *and* on every route it calls, since those are reachable directly.
 *
 * A paper that already has per-question passages stays with the per-question
 * editor on its workbench; the two flows never share a paper.
 */
export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const test = await getTestById(id);
  if (!test) notFound();

  const workbench = `/dashboard/admin/tests/${test.id}`;
  if (test.subject !== 'word') redirect(workbench);
  if ((await questionsForTest(test.id)).length > 0) redirect(workbench);

  const paper = await getDocumentPaper(test.id);
  const questions: AuthoringQuestion[] = (paper?.questions ?? []).map((question) => ({
    id: question.id,
    position: question.position,
    topic: question.topic,
    difficulty: question.difficulty,
    marks: question.marks,
    instructionEn: question.instructionEn,
    instructionHi: question.instructionHi,
    solutionEn: question.solutionEn,
    solutionHi: question.solutionHi,
    steps: question.steps,
  }));

  return (
    <DocumentAuthoringShell
      testId={test.id}
      testName={test.name}
      passage={paper?.passage ?? null}
      questions={questions}
    />
  );
}
