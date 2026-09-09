import { NextResponse } from 'next/server';
import { requireUser } from '@/auth/cookies';
import { subscribeUserToPlan } from '@/db/plans';

/**
 * Activates a plan for the signed-in user — the entire "purchase" flow.
 * No payment gateway exists yet, so there is no payment step to gate behind;
 * this is a self-service switch, not a webhook a payment provider calls.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  planId?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' }, { status: 400 });
  }

  if (!body.planId) return NextResponse.json({ code: 'PLAN_ID_REQUIRED', detail: 'Choose a plan.' }, { status: 400 });

  const result = await subscribeUserToPlan(user.id, body.planId);
  if (!result.ok) {
    const status = result.code === 'NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ code: result.code, detail: result.detail }, { status });
  }

  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
