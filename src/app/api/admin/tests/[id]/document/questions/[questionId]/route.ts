import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import {
  deleteDocumentQuestion,
  documentBefore,
  getDocumentPaper,
  getDocumentQuestion,
  updateDocumentQuestion,
} from '@/db/documentPapers';
import { parseDocumentQuestionFields, parseEditorDocument, type DocumentQuestionInput } from '@/db/documentPaperInput';
import { overlapWarnings } from '@/exam/document/overlap';
import { recordQuestion } from '@/exam/document/record';

/**
 * Editing or deleting one question of a single-document Word paper.
 *
 * `PUT` always replaces the wording. When it also carries a `document`, the
 * question is *re-recorded*: its operation is detected again against the
 * document it was originally recorded on — the passage with every earlier
 * question replayed — so fixing question 3 does not need questions 4 onwards
 * redone. Later questions keep what they detected; it was a statement about
 * their own characters, which re-recording an earlier one does not move.
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

  const question = await getDocumentQuestion(questionId);
  // The question must belong to the test in the path, or a crafted URL could
  // edit another paper's question through this one's permissions check.
  if (!question || question.testId !== id) return refuse(404, 'NOT_FOUND', 'No such question.');

  let body: DocumentQuestionInput;
  try {
    body = (await request.json()) as DocumentQuestionInput;
  } catch {
    return refuse(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  const fields = parseDocumentQuestionFields(body);
  if (!fields.ok) return refuse(400, fields.code, fields.detail);

  if (body.document === undefined) {
    const updated = await updateDocumentQuestion(question.id, fields.fields);
    return NextResponse.json({ question: updated, warnings: [] }, { headers: { 'cache-control': 'no-store' } });
  }

  const paper = await getDocumentPaper(id);
  if (!paper) return refuse(409, 'PASSAGE_REQUIRED', 'This paper has no passage.');

  const after = parseEditorDocument(body.document);
  if (!after.ok) return refuse(400, after.code, after.detail);

  const recorded = recordQuestion(documentBefore(paper, question.position), after.fields);
  if (!recorded.ok) return refuse(400, recorded.code, recorded.detail);

  const updated = await updateDocumentQuestion(question.id, fields.fields, recorded.steps);
  const warnings = overlapWarnings(
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

  const question = await getDocumentQuestion(questionId);
  if (!question || question.testId !== id) return refuse(404, 'NOT_FOUND', 'No such question.');

  await deleteDocumentQuestion(question);
  return NextResponse.json({ deleted: true }, { headers: { 'cache-control': 'no-store' } });
}
