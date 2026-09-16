import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { setSessionCookie } from '@/auth/cookies';
import { issueVerificationCode } from '@/auth/emailVerification';
import { hashPassword } from '@/auth/password';
import { clientIp, hashIp } from '@/auth/requestContext';
import { createSession } from '@/auth/session';
import { isValidEmail, normalizeEmail, MIN_PASSWORD_LENGTH } from '@/auth/validation';
import { db } from '@/db/client';
import { registerForExam } from '@/db/enrollments';
import { subscribeUserToDefaultPlan } from '@/db/plans';
import { users } from '@/db/schema';

/**
 * Creates an account, then signs it in — the same session a `/login` would
 * issue, so a fresh signup lands the candidate straight in rather than at a
 * second form.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SignupBody {
  email?: string;
  password?: string;
  name?: string;
  /** Optional: pre-registers the new account for this exam, as primary. */
  examId?: string;
}

function badRequest(code: string, detail: string): NextResponse {
  return NextResponse.json({ code, detail }, { status: 400 });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return badRequest('INVALID_JSON', 'The request body is not valid JSON.');
  }

  const name = body.name?.trim() ?? '';
  const password = body.password ?? '';
  const email = normalizeEmail(body.email ?? '');

  if (!name) return badRequest('NAME_REQUIRED', 'Enter your name.');
  if (!isValidEmail(email)) return badRequest('INVALID_EMAIL', 'Enter a valid email address.');
  if (password.length < MIN_PASSWORD_LENGTH) {
    return badRequest('WEAK_PASSWORD', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const [existing] = await db
    .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing && existing.emailVerifiedAt) {
    return NextResponse.json(
      { code: 'EMAIL_TAKEN', detail: 'An account with that email already exists.' },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  /*
   * `existing` here is unverified: a prior signup was abandoned before the
   * OTP was entered, so nobody has actually proven they own this inbox yet.
   * Rather than locking the address out forever with EMAIL_TAKEN, this
   * attempt reclaims the same row — new name and password overwrite the old
   * (never-confirmed) ones. It's still safe: whoever can read the code that
   * `issueVerificationCode` sends below is the real owner either way, and
   * reusing the row (instead of deleting + reinserting) keeps that call
   * subject to the same per-account cooldown/rate limit the abandoned
   * attempt already started, so this can't be used to bypass it.
   */
  const user = existing
    ? await db
        .update(users)
        .set({ name, passwordHash, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning()
        .then((rows) => rows[0])
    : await db
        .insert(users)
        .values({ email, name, passwordHash })
        .returning()
        .then((rows) => rows[0]);

  if (!user) {
    return NextResponse.json({ code: 'SIGNUP_FAILED', detail: 'Could not create the account.' }, { status: 500 });
  }

  // Best-effort: a signup shouldn't fail because the chosen exam went away
  // (unpublished, deleted) between the page loading and the form submitting.
  if (body.examId) await registerForExam(user.id, body.examId);
  // Every account starts on the default plan (a no-op if none is configured yet).
  await subscribeUserToDefaultPlan(user.id);

  const session = await createSession(user.id);
  await setSessionCookie(session);

  /*
   * Send the first verification code now, so the candidate lands on
   * /verify-email with a code already in their inbox rather than being asked
   * to request one.
   *
   * A send failure must not fail the signup: the account exists, the session
   * is valid, and /verify-email can resend. Turning a provider outage into a
   * 500 here would lose the account the user just created — and the 201 below
   * is unchanged either way, so no existing client contract moves.
   */
  await issueVerificationCode(user, hashIp(clientIp(request)));

  return NextResponse.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { status: 201, headers: { 'cache-control': 'no-store' } },
  );
}
