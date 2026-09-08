import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { db } from '@/db/client';
import { exams, type NewExam } from '@/db/schema';
import { parseExamInput, type ExamInput } from '@/db/examInput';
import { isUniqueViolation } from '@/db/pgErrors';
import { slugify } from '@/db/slug';

/**
 * Creates an exam listing. Admin-only — `requireAdmin()` 404s a non-admin
 * caller here regardless of whether they got past the `/dashboard/admin/*`
 * page-level check, since this route is reachable directly.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function badRequest(code: string, detail: string): NextResponse {
  return NextResponse.json({ code, detail }, { status: 400 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const admin = await requireAdmin();

  let body: ExamInput;
  try {
    body = (await request.json()) as ExamInput;
  } catch {
    return badRequest('INVALID_JSON', 'The request body is not valid JSON.');
  }

  const parsed = parseExamInput(body);
  if (!parsed.ok) return badRequest(parsed.code, parsed.detail);

  const baseSlug = slugify(parsed.fields.name) || 'exam';
  const values: NewExam = { ...parsed.fields, slug: baseSlug, createdBy: admin.id };

  try {
    const [created] = await db.insert(exams).values(values).returning();
    return NextResponse.json({ exam: created }, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    // Unique slug collision (Postgres 23505) — same exam name added twice.
    // Retry once with a short disambiguating suffix rather than failing.
    if (isUniqueViolation(error)) {
      const [created] = await db
        .insert(exams)
        .values({ ...values, slug: `${baseSlug}-${crypto.randomUUID().slice(0, 6)}` })
        .returning();
      return NextResponse.json({ exam: created }, { status: 201, headers: { 'cache-control': 'no-store' } });
    }
    throw error;
  }
}
