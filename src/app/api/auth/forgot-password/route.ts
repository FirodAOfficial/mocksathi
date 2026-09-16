import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { issuePasswordResetCode } from '@/auth/passwordReset';
import { clientIp, hashIp } from '@/auth/requestContext';
import { isValidEmail, normalizeEmail } from '@/auth/validation';
import { db } from '@/db/client';
import { users } from '@/db/schema';

/**
 * Requests a password-reset code.
 *
 * Always answers the same way regardless of whether the address has an
 * account, whether a code was actually sent, or why it wasn't (cooldown,
 * rate limit, Resend outage) — the one thing this endpoint must never do is
 * let a caller tell "no such account" apart from "already asked 30 seconds
 * ago" apart from "sent". Any of those differing would let someone enumerate
 * which emails have accounts, which a signed-out endpoint has no way to
 * guard otherwise. Compare `POST /api/auth/verify-email/request`, which can
 * afford to be specific because it's behind `requireUser` — the caller there
 * already holds a session for the address in question.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ForgotPasswordBody {
  email?: string;
}

/**
 * A fresh `NextResponse` per call, not a module-level constant — a `Response`
 * body is a single-use stream, so sharing one instance across concurrent
 * requests would work by accident until two requests raced to read it.
 */
function genericResponse(): NextResponse {
  return NextResponse.json(
    { detail: 'If an account exists for that email, a password reset code is on its way.' },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: ForgotPasswordBody;
  try {
    body = (await request.json()) as ForgotPasswordBody;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? '');
  if (!isValidEmail(email)) {
    return NextResponse.json({ code: 'INVALID_EMAIL', detail: 'Enter a valid email address.' }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user) await issuePasswordResetCode(user, hashIp(clientIp(request)));

  return genericResponse();
}
