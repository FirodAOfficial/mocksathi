import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { db } from '@/db/client';
import { exams } from '@/db/schema';
import { isUniqueSlugViolation, parseExamInput, type ExamInput } from '@/db/examInput';
import { slugify } from '@/db/slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function badRequest(code: string, detail: string): NextResponse {
  return NextResponse.json({ code, detail }, { status: 400 });
}

/**
 * Replaces an existing exam listing. Admin-only, same as `POST /api/admin/exams`.
 *
 * `PUT`, not `PATCH`: `parseExamInput` treats every field the caller doesn't
 * send as "clear it" (same as create), so this is whole-resource-replace
 * semantics, not a partial merge. `ExamForm` always submits every field —
 * its state starts from the existing exam — so that's never an issue from
 * the UI; it would be a footgun for any other caller sending a partial body.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await params;

  const [existing] = await db.select().from(exams).where(eq(exams.id, id)).limit(1);
  if (!existing) return NextResponse.json({ code: 'NOT_FOUND', detail: 'No such exam.' }, { status: 404 });

  let body: ExamInput;
  try {
    body = (await request.json()) as ExamInput;
  } catch {
    return badRequest('INVALID_JSON', 'The request body is not valid JSON.');
  }

  const parsed = parseExamInput(body);
  if (!parsed.ok) return badRequest(parsed.code, parsed.detail);

  // Keep the slug in step with the name; only regenerate it when the name actually changed,
  // so an edit that doesn't touch the name can't accidentally reassign the slug.
  const baseSlug = parsed.fields.name === existing.name ? existing.slug : slugify(parsed.fields.name) || 'exam';
  const values = { ...parsed.fields, slug: baseSlug, updatedAt: new Date() };

  try {
    const [updated] = await db.update(exams).set(values).where(eq(exams.id, id)).returning();
    return NextResponse.json({ exam: updated }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (isUniqueSlugViolation(error)) {
      const [updated] = await db
        .update(exams)
        .set({ ...values, slug: `${baseSlug}-${crypto.randomUUID().slice(0, 6)}` })
        .where(eq(exams.id, id))
        .returning();
      return NextResponse.json({ exam: updated }, { headers: { 'cache-control': 'no-store' } });
    }
    throw error;
  }
}
