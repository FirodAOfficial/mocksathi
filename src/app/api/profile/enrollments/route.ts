import { NextResponse } from 'next/server';
import { requireUser } from '@/auth/cookies';
import { registerForExam } from '@/db/enrollments';

/** Registers the signed-in user for an exam. Self-service — any signed-in user, not admin-only. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  examId?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' }, { status: 400 });
  }

  if (!body.examId) {
    return NextResponse.json({ code: 'EXAM_ID_REQUIRED', detail: 'Choose an exam.' }, { status: 400 });
  }

  const result = await registerForExam(user.id, body.examId);
  if (!result.ok) {
    const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'ALREADY_REGISTERED' ? 409 : 400;
    return NextResponse.json({ code: result.code, detail: result.detail }, { status });
  }

  return NextResponse.json({ ok: true }, { status: 201, headers: { 'cache-control': 'no-store' } });
}
