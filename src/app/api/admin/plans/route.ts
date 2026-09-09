import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { createPlan } from '@/db/plans';
import { parsePlanInput, type PlanInput } from '@/db/planInput';

/** Creates a subscription plan. Admin-only — `requireAdmin()` 404s a non-admin caller regardless of the page-level check. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  await requireAdmin();

  let body: PlanInput;
  try {
    body = (await request.json()) as PlanInput;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const parsed = parsePlanInput(body);
  if (!parsed.ok) return NextResponse.json({ code: parsed.code, detail: parsed.detail }, { status: 400 });

  const plan = await createPlan(parsed.fields);
  return NextResponse.json({ plan }, { status: 201, headers: { 'cache-control': 'no-store' } });
}
