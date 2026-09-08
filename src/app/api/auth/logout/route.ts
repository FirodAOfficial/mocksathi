import { NextResponse } from 'next/server';
import { clearSessionCookie, readSessionToken } from '@/auth/cookies';
import { deleteSession } from '@/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const token = await readSessionToken();
  if (token) await deleteSession(token);
  await clearSessionCookie();

  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
