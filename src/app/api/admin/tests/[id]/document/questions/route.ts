import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { addDocumentQuestion, documentBefore, getDocumentPaper } from '@/db/documentPapers';
import {
  MAX_DOCUMENT_QUESTIONS,
  parseDocumentQuestionFields,
  parseEditorDocument,
  type DocumentQuestionInput,
} from '@/db/documentPaperInput';
import { getTestById, questionsForTest } from '@/db/tests';
import { overlapWarnings } from '@/exam/document/overlap';
import { recordQuestion } from '@/exam/document/record';

/**
 * Records the next question of a single-document Word paper.
 *
 * The body carries the admin's wording and the editor's document *after* they
 * performed the operation. The document *before* is not taken from the
 * request: it is rebuilt here from the stored passage and every stored
 * question (`documentBefore`), and the operation is detected from the two
 * (`recordQuestion`). What the browser showed the admin as "detected" is a
 * preview of this, never an input to it.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function refuse(status: number, code: string, detail: string): NextResponse {
  return NextResponse.json({ code, detail }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await params;

  const test = await getTestById(id);
  if (!test) return refuse(404, 'NOT_FOUND', 'No such test.');
  if (test.subject !== 'word') return refuse(400, 'NOT_A_WORD_PAPER', 'Only a Word paper is written on one document.');

  const [legacy, paper] = await Promise.all([questionsForTest(id), getDocumentPaper(id)]);
  if (legacy.length > 0) {
    return refuse(409, 'PER_QUESTION_PAPER', 'This paper already has per-question passages.');
  }
  if (!paper) return refuse(409, 'PASSAGE_REQUIRED', 'Save the passage before recording questions on it.');
  if (paper.questions.length >= MAX_DOCUMENT_QUESTIONS) {
    return refuse(409, 'TOO_MANY_QUESTIONS', `A paper may have at most ${MAX_DOCUMENT_QUESTIONS} questions.`);
  }

  let body: DocumentQuestionInput;
  try {
    body = (await request.json()) as DocumentQuestionInput;
  } catch {
    return refuse(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  const fields = parseDocumentQuestionFields(body);
  if (!fields.ok) return refuse(400, fields.code, fields.detail);

  const after = parseEditorDocument(body.document);
  if (!after.ok) return refuse(400, after.code, after.detail);

  const recorded = recordQuestion(documentBefore(paper), after.fields);
  if (!recorded.ok) return refuse(400, recorded.code, recorded.detail);

  const question = await addDocumentQuestion(id, fields.fields, recorded.steps);
  const warnings = overlapWarnings(
    recorded.steps,
    paper.questions.map((other) => ({ number: other.position, steps: other.steps })),
  );

  return NextResponse.json({ question, warnings }, { status: 201, headers: { 'cache-control': 'no-store' } });
}
