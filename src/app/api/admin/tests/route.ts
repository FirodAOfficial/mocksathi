import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { db } from '@/db/client';
import { exams } from '@/db/schema';
import { createTest } from '@/db/tests';
import { parseTestInput, type TestInput } from '@/db/testInput';

/**
 * Creates a test — one paper, belonging to one exam.
 *
 * Admin-only. `requireAdmin()` 404s a non-admin here regardless of whether
 * they got past the `/dashboard/admin/*` page check, since this route is
 * reachable directly.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function badRequest(code: string, detail: string): NextResponse {
  return NextResponse.json({ code, detail }, { status: 400 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const admin = await requireAdmin();

  let body: TestInput;
  try {
    body = (await request.json()) as TestInput;
  } catch {
    return badRequest('INVALID_JSON', 'The request body is not valid JSON.');
  }

  const parsed = parseTestInput(body);
  if (!parsed.ok) return badRequest(parsed.code, parsed.detail);

  // Checked here rather than left to the foreign key: a 23503 would come back
  // as a 500 with nothing an admin could act on.
  const [exam] = await db.select({ id: exams.id }).from(exams).where(eq(exams.id, parsed.fields.examId)).limit(1);
  if (!exam) return badRequest('EXAM_NOT_FOUND', 'That exam no longer exists — pick another.');

  const created = await createTest(parsed.fields, admin.id);
  return NextResponse.json({ test: created }, { status: 201, headers: { 'cache-control': 'no-store' } });
}
