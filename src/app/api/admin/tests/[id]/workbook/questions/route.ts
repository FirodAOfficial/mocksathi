import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { parseDocumentQuestionFields, type DocumentQuestionInput } from '@/db/documentPaperInput';
import { getTestById, questionsForTest } from '@/db/tests';
import { addWorkbookQuestion, getWorkbookPaper, workbookBefore } from '@/db/workbookPapers';
import { MAX_WORKBOOK_QUESTIONS, parseEditorWorkbook } from '@/db/workbookPaperInput';
import { recordWorkbookQuestion, workbookOverlapWarnings } from '@/exam/workbook/record';

/**
 * Records the next question of a single-workbook Excel paper. The before is
 * rebuilt here from the stored sheet and questions; only the after comes from
 * the request, and the operation is detected from the two on the server.
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
  if (test.subject !== 'excel') {
    return refuse(400, 'NOT_AN_EXCEL_PAPER', 'Only an Excel paper is written on one workbook.');
  }

  const [legacy, paper] = await Promise.all([questionsForTest(id), getWorkbookPaper(id)]);
  if (legacy.length > 0) return refuse(409, 'PER_QUESTION_PAPER', 'This paper already has per-question sheets.');
  if (!paper) return refuse(409, 'WORKBOOK_REQUIRED', 'Save the sheet before recording questions on it.');
  if (paper.questions.length >= MAX_WORKBOOK_QUESTIONS) {
    return refuse(409, 'TOO_MANY_QUESTIONS', `A paper may have at most ${MAX_WORKBOOK_QUESTIONS} questions.`);
  }

  let body: DocumentQuestionInput & { workbook?: unknown };
  try {
    body = (await request.json()) as DocumentQuestionInput & { workbook?: unknown };
  } catch {
    return refuse(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  const fields = parseDocumentQuestionFields(body, 'excel');
  if (!fields.ok) return refuse(400, fields.code, fields.detail);

  const after = parseEditorWorkbook(body.workbook);
  if (!after.ok) return refuse(400, after.code, after.detail);

  const recorded = recordWorkbookQuestion(workbookBefore(paper), after.fields);
  if (!recorded.ok) return refuse(400, recorded.code, recorded.detail);

  const question = await addWorkbookQuestion(id, fields.fields, recorded.steps);
  const warnings = workbookOverlapWarnings(
    recorded.steps,
    paper.questions.map((other) => ({ number: other.position, steps: other.steps })),
  );

  return NextResponse.json({ question, warnings }, { status: 201, headers: { 'cache-control': 'no-store' } });
}
