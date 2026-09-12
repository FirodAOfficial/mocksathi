import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { deleteQuestion, getQuestionById, getTestById, moveQuestion, updateQuestion } from '@/db/tests';
import { parseQuestionInput, type QuestionInput } from '@/db/testInput';
import type { Test, TestQuestion } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function notFound(): NextResponse {
  return NextResponse.json({ code: 'NOT_FOUND', detail: 'No such question.' }, { status: 404 });
}

/**
 * The test and the question, once it is established the question is that
 * test's.
 *
 * Both ids come from the URL and a question id is a UUID, so this is not the
 * only thing standing between an admin and someone else's question — but a
 * mismatched pair means one of the two is stale, and editing on that basis
 * would write to a paper nobody was looking at.
 */
async function resolve(testId: string, questionId: string): Promise<{ test: Test; question: TestQuestion } | null> {
  const [test, question] = await Promise.all([getTestById(testId), getQuestionById(questionId)]);
  if (!test || !question || question.testId !== test.id) return null;
  return { test, question };
}

/** Replaces a question's fields. Its position is moved by `PATCH`, not here. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id, questionId } = await params;

  const found = await resolve(id, questionId);
  if (!found) return notFound();

  let body: QuestionInput;
  try {
    body = (await request.json()) as QuestionInput;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const parsed = parseQuestionInput(body, found.test.subject);
  if (!parsed.ok) return NextResponse.json({ code: parsed.code, detail: parsed.detail }, { status: 400 });

  const updated = await updateQuestion(found.question.id, parsed.fields);
  if (!updated) return notFound();

  return NextResponse.json({ question: updated }, { headers: { 'cache-control': 'no-store' } });
}

/**
 * Moves a question one place up or down.
 *
 * Its own verb rather than a `position` field on `PUT`: reordering is a swap
 * with a neighbour, not a value the client gets to choose. A client that could
 * name the position could give two questions the same one, and the numbers are
 * what the palette and the result screen agree to call them.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id, questionId } = await params;

  const found = await resolve(id, questionId);
  if (!found) return notFound();

  let body: { move?: unknown };
  try {
    body = (await request.json()) as { move?: unknown };
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' }, { status: 400 });
  }

  if (body.move !== 'up' && body.move !== 'down') {
    return NextResponse.json({ code: 'INVALID_MOVE', detail: 'Say whether to move the question up or down.' }, { status: 400 });
  }

  const moved = await moveQuestion(found.question, body.move);
  return NextResponse.json({ moved }, { headers: { 'cache-control': 'no-store' } });
}

/** Deletes a question and closes the gap its number leaves. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id, questionId } = await params;

  const found = await resolve(id, questionId);
  if (!found) return notFound();

  await deleteQuestion(found.question);
  return NextResponse.json({ deleted: true }, { headers: { 'cache-control': 'no-store' } });
}
