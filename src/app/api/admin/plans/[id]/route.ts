import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { updatePlan } from '@/db/plans';
import { parsePlanInput, type PlanInput } from '@/db/planInput';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Replaces a plan's fields. Admin-only, same as `POST /api/admin/plans`. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await params;

  let body: PlanInput;
  try {
    body = (await request.json()) as PlanInput;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const parsed = parsePlanInput(body);
  if (!parsed.ok) return NextResponse.json({ code: parsed.code, detail: parsed.detail }, { status: 400 });

  const plan = await updatePlan(id, parsed.fields);
  if (!plan) return NextResponse.json({ code: 'NOT_FOUND', detail: 'No such plan.' }, { status: 404 });

  return NextResponse.json({ plan }, { headers: { 'cache-control': 'no-store' } });
}
