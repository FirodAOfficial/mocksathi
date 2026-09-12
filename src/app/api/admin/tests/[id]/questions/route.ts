import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { addQuestion, getTestById } from '@/db/tests';
import { parseQuestionInput, type QuestionInput } from '@/db/testInput';

/**
 * Adds a question to the end of a paper.
 *
 * The subject comes from the test, never from the body: a question belongs to
 * a paper, the paper decides which application it is sat in, and a request
 * that said otherwise would put an Excel question in a Word paper.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await params;

  const test = await getTestById(id);
  if (!test) return NextResponse.json({ code: 'NOT_FOUND', detail: 'No such test.' }, { status: 404 });

  let body: QuestionInput;
  try {
    body = (await request.json()) as QuestionInput;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const parsed = parseQuestionInput(body, test.subject);
  if (!parsed.ok) return NextResponse.json({ code: parsed.code, detail: parsed.detail }, { status: 400 });

  const created = await addQuestion(test.id, parsed.fields);
  return NextResponse.json({ question: created }, { status: 201, headers: { 'cache-control': 'no-store' } });
}
