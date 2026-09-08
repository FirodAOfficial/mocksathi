import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/cookies';

/** Who, if anyone, the request's session cookie belongs to. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  return NextResponse.json(
    { user: user ? { id: user.id, email: user.email, name: user.name } : null },
    { headers: { 'cache-control': 'no-store' } },
  );
}
