import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { setSessionCookie } from '@/auth/cookies';
import { confirmPasswordReset } from '@/auth/passwordReset';
import { OTP_LENGTH } from '@/auth/otpPolicy';
import { isValidEmail, normalizeEmail, MIN_PASSWORD_LENGTH } from '@/auth/validation';
import { createSession } from '@/auth/session';
import { db } from '@/db/client';
import { users } from '@/db/schema';

/**
 * Confirms a password-reset code and signs the caller in with the new
 * password — the same "prove it, then land them in" shape `POST /api/auth/
 * signup` uses, since entering the emailed code is at least as strong a
 * proof of ownership as a fresh signup's session ever was.
 *
 * Every failure — no such account, no code, wrong code, expired, exhausted —
 * answers with the same `INVALID_CODE` message. This route is unauthenticated
 * (unlike `POST /api/auth/verify-email/confirm`, which can be specific because
 * the caller already holds a session for the address), so telling those apart
 * would let a caller learn whether an email has an account from this endpoint
 * alone. See `POST /api/auth/forgot-password` for the same reasoning on the
 * request side.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ResetPasswordBody {
  email?: string;
  code?: string;
  newPassword?: string;
}

function invalidCode(): NextResponse {
  return NextResponse.json(
    { code: 'INVALID_CODE', detail: 'That code is incorrect or has expired. Request a new one.' },
    { status: 400 },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: ResetPasswordBody;
  try {
    body = (await request.json()) as ResetPasswordBody;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? '');
  const newPassword = body.newPassword ?? '';
  // Spaces and dashes stripped: people paste "048 261" out of an email.
  const code = (body.code ?? '').replace(/[\s-]/g, '');

  if (!isValidEmail(email)) {
    return NextResponse.json({ code: 'INVALID_EMAIL', detail: 'Enter a valid email address.' }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { code: 'WEAK_PASSWORD', detail: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) return invalidCode();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return invalidCode();

  const result = await confirmPasswordReset(user, code, newPassword);
  if (!result.ok) return invalidCode();

  const session = await createSession(user.id);
  await setSessionCookie(session);

  return NextResponse.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { headers: { 'cache-control': 'no-store' } },
  );
}
