import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { setSessionCookie } from '@/auth/cookies';
import { verifyPassword } from '@/auth/password';
import { createSession } from '@/auth/session';
import { normalizeEmail } from '@/auth/validation';
import { db } from '@/db/client';
import { users } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LoginBody {
  email?: string;
  password?: string;
}

// One message for both "no such account" and "wrong password" — telling them
// apart would let a caller enumerate which emails have accounts.
function invalidCredentials(): NextResponse {
  return NextResponse.json(
    { code: 'INVALID_CREDENTIALS', detail: 'Incorrect email or password.' },
    { status: 401 },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? '');
  const password = body.password ?? '';
  if (!email || !password) return invalidCredentials();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return invalidCredentials();

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) return invalidCredentials();

  const session = await createSession(user.id);
  await setSessionCookie(session);

  return NextResponse.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { headers: { 'cache-control': 'no-store' } },
  );
}
