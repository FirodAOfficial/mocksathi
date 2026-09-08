import { NextResponse } from 'next/server';
import { publishedExams } from '@/db/enrollments';

/**
 * The one exam-related route that doesn't require being signed in — a
 * minimal, public listing (id, name, category only; never organiser
 * details, dates, fees, or anything else `exams` carries) for contexts like
 * the signup form's exam picker, before there's a session to check.
 *
 * Every other exam/enrollment route requires auth: `/api/admin/exams*`
 * (`requireAdmin`) and `/api/profile/enrollments*` (`requireUser`).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const exams = await publishedExams();
  const minimal = exams.map((exam) => ({ id: exam.id, name: exam.name, category: exam.category }));
  return NextResponse.json({ exams: minimal }, { headers: { 'cache-control': 'no-store' } });
}
