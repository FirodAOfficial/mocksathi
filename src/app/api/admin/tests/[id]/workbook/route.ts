import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { getTestById, questionsForTest } from '@/db/tests';
import { saveStartingWorkbook, workbookQuestionsFor } from '@/db/workbookPapers';
import { parseStartingWorkbook } from '@/db/workbookPaperInput';

/**
 * Saves the starting workbook of a single-workbook Excel paper. Admin-only here
 * as well as on the page. Refused once questions exist: every question is
 * stored by cell address against this sheet.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function refuse(status: number, code: string, detail: string): NextResponse {
  return NextResponse.json({ code, detail }, { status });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await params;

  const test = await getTestById(id);
  if (!test) return refuse(404, 'NOT_FOUND', 'No such test.');
  if (test.subject !== 'excel') {
    return refuse(400, 'NOT_AN_EXCEL_PAPER', 'Only an Excel paper is written on one workbook.');
  }

  const [legacy, questions] = await Promise.all([questionsForTest(id), workbookQuestionsFor(id)]);
  if (legacy.length > 0) {
    return refuse(
      409,
      'PER_QUESTION_PAPER',
      'This paper already has per-question sheets, so it cannot also have a single workbook.',
    );
  }
  if (questions.length > 0) {
    return refuse(
      409,
      'WORKBOOK_LOCKED',
      'The sheet is fixed once questions have been recorded on it. Delete every question to change it.',
    );
  }

  let body: { workbook?: unknown };
  try {
    body = (await request.json()) as { workbook?: unknown };
  } catch {
    return refuse(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  const parsed = parseStartingWorkbook(body.workbook);
  if (!parsed.ok) return refuse(400, parsed.code, parsed.detail);

  await saveStartingWorkbook(id, parsed.fields);
  return NextResponse.json({ workbook: parsed.fields }, { headers: { 'cache-control': 'no-store' } });
}
