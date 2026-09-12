import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { db } from '@/db/client';
import { exams } from '@/db/schema';
import { deleteTest, getTestById, questionsForTest, updateTest } from '@/db/tests';
import { parseTestInput, type TestInput } from '@/db/testInput';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function badRequest(code: string, detail: string): NextResponse {
  return NextResponse.json({ code, detail }, { status: 400 });
}

function notFound(): NextResponse {
  return NextResponse.json({ code: 'NOT_FOUND', detail: 'No such test.' }, { status: 404 });
}

/**
 * Replaces a test's fields. Admin-only, same as `POST /api/admin/tests`.
 *
 * `PUT`, not `PATCH`, for the same reason `/api/admin/exams/[id]` is:
 * `parseTestInput` treats an absent field as "clear it", so this is
 * whole-resource replacement. `TestForm` always submits every field.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await params;

  const existing = await getTestById(id);
  if (!existing) return notFound();

  let body: TestInput;
  try {
    body = (await request.json()) as TestInput;
  } catch {
    return badRequest('INVALID_JSON', 'The request body is not valid JSON.');
  }

  const parsed = parseTestInput(body);
  if (!parsed.ok) return badRequest(parsed.code, parsed.detail);

  /*
   * A paper with questions cannot change application.
   *
   * Every question holds either a passage or a grid, and the shell that opens
   * it branches on this one field — so flipping a Word paper to Excel would
   * hand the spreadsheet fifteen questions with no sheet. Refused with a
   * reason rather than silently ignored, so the admin knows to empty the paper
   * first if that really is what they meant.
   */
  if (parsed.fields.subject !== existing.subject) {
    const questions = await questionsForTest(id);
    if (questions.length > 0) {
      return badRequest(
        'SUBJECT_LOCKED',
        'This paper already has questions, so it cannot be switched between Word and Excel. Delete its questions first, or create a new test.',
      );
    }
  }

  const [exam] = await db.select({ id: exams.id }).from(exams).where(eq(exams.id, parsed.fields.examId)).limit(1);
  if (!exam) return badRequest('EXAM_NOT_FOUND', 'That exam no longer exists — pick another.');

  const updated = await updateTest(id, parsed.fields, existing);
  if (!updated) return notFound();

  return NextResponse.json({ test: updated }, { headers: { 'cache-control': 'no-store' } });
}

/** Deletes a test and, by cascade, its questions. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await params;

  const existing = await getTestById(id);
  if (!existing) return notFound();

  await deleteTest(id);
  return NextResponse.json({ deleted: true }, { headers: { 'cache-control': 'no-store' } });
}
