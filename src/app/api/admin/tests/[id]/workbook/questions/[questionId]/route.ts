import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { parseDocumentQuestionFields, type DocumentQuestionInput } from '@/db/documentPaperInput';
import {
  deleteWorkbookQuestion,
  getWorkbookPaper,
  getWorkbookQuestion,
  updateWorkbookQuestion,
  workbookBefore,
} from '@/db/workbookPapers';
import { parseEditorWorkbook } from '@/db/workbookPaperInput';
import { recordWorkbookQuestion, workbookOverlapWarnings } from '@/exam/workbook/record';

/**
 * Editing or deleting one question of a single-workbook Excel paper. `PUT`
 * replaces the wording, and re-records the operation when a `workbook` is sent —
 * against the sheet the question was originally recorded on.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; questionId: string }> };

function refuse(status: number, code: string, detail: string): NextResponse {
  return NextResponse.json({ code, detail }, { status });
}

export async function PUT(request: Request, { params }: Params): Promise<NextResponse> {
  await requireAdmin();
  const { id, questionId } = await params;

  const question = await getWorkbookQuestion(questionId);
  // It must belong to the test in the path, or a crafted URL could edit another paper's question.
  if (!question || question.testId !== id) return refuse(404, 'NOT_FOUND', 'No such question.');

  let body: DocumentQuestionInput & { workbook?: unknown };
  try {
    body = (await request.json()) as DocumentQuestionInput & { workbook?: unknown };
  } catch {
    return refuse(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  const fields = parseDocumentQuestionFields(body, 'excel');
  if (!fields.ok) return refuse(400, fields.code, fields.detail);

  if (body.workbook === undefined) {
    const updated = await updateWorkbookQuestion(question.id, fields.fields);
    return NextResponse.json({ question: updated, warnings: [] }, { headers: { 'cache-control': 'no-store' } });
  }

  const paper = await getWorkbookPaper(id);
  if (!paper) return refuse(409, 'WORKBOOK_REQUIRED', 'This paper has no sheet.');

  const after = parseEditorWorkbook(body.workbook);
  if (!after.ok) return refuse(400, after.code, after.detail);

  const recorded = recordWorkbookQuestion(workbookBefore(paper, question.position), after.fields);
  if (!recorded.ok) return refuse(400, recorded.code, recorded.detail);

  const updated = await updateWorkbookQuestion(question.id, fields.fields, recorded.steps);
  const warnings = workbookOverlapWarnings(
    recorded.steps,
    paper.questions
      .filter((other) => other.id !== question.id)
      .map((other) => ({ number: other.position, steps: other.steps })),
  );
  return NextResponse.json({ question: updated, warnings }, { headers: { 'cache-control': 'no-store' } });
}

export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  await requireAdmin();
  const { id, questionId } = await params;

  const question = await getWorkbookQuestion(questionId);
  if (!question || question.testId !== id) return refuse(404, 'NOT_FOUND', 'No such question.');

  await deleteWorkbookQuestion(question);
  return NextResponse.json({ deleted: true }, { headers: { 'cache-control': 'no-store' } });
}
