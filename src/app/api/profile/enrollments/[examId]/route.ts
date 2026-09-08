import { NextResponse } from 'next/server';
import { requireUser } from '@/auth/cookies';
import { setPrimaryExam, unregisterFromExam } from '@/db/enrollments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Unregisters the signed-in user from an exam. Promotes another registration to primary if that one was it. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ examId: string }> }): Promise<NextResponse> {
  const user = await requireUser();
  const { examId } = await params;

  const result = await unregisterFromExam(user.id, examId);
  if (!result.ok) return NextResponse.json({ code: result.code, detail: result.detail }, { status: 404 });

  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}

/** Sets which registered exam is primary (shown in the topbar picker). Body is currently ignored — this route only ever means "make this one primary". */
export async function PATCH(_request: Request, { params }: { params: Promise<{ examId: string }> }): Promise<NextResponse> {
  const user = await requireUser();
  const { examId } = await params;

  const result = await setPrimaryExam(user.id, examId);
  if (!result.ok) return NextResponse.json({ code: result.code, detail: result.detail }, { status: 404 });

  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
