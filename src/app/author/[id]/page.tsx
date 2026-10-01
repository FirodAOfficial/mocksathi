import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/auth/cookies';
import { DocumentAuthoringShell } from '@/components/authoring/DocumentAuthoringShell';
import type { AuthoringQuestion } from '@/components/authoring/useAuthoringFlow';
import { WorkbookAuthoringShell } from '@/components/authoring/WorkbookAuthoringShell';
import { getDocumentPaper } from '@/db/documentPapers';
import { getWorkbookPaper } from '@/db/workbookPapers';
import { getTestById, questionsForTest } from '@/db/tests';

export const metadata: Metadata = {
  title: 'Write a paper',
  robots: { index: false, follow: false },
};

/**
 * `/author/<test id>` — writing a single-document Word paper, or a
 * single-workbook Excel paper.
 *
 * Outside `/dashboard` so it gets the whole screen, like `/editor`: the admin is
 * working in the same Word or spreadsheet chrome a candidate sits the paper in. Admin-only
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
  if ((await questionsForTest(test.id)).length > 0) redirect(workbench);

  const fields = <Step,>(question: AuthoringQuestion<Step>): AuthoringQuestion<Step> => ({
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
  });

  if (test.subject === 'excel') {
    const paper = await getWorkbookPaper(test.id);
    return (
      <WorkbookAuthoringShell
        testId={test.id}
        testName={test.name}
        workbook={paper?.workbook ?? null}
        questions={(paper?.questions ?? []).map(fields)}
      />
    );
  }

  const paper = await getDocumentPaper(test.id);
  const questions = (paper?.questions ?? []).map(fields);

  return (
    <DocumentAuthoringShell
      testId={test.id}
      testName={test.name}
      passage={paper?.passage ?? null}
      questions={questions}
    />
  );
}
