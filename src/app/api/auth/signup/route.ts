import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { setSessionCookie } from '@/auth/cookies';
import { hashPassword } from '@/auth/password';
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

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json(
      { code: 'EMAIL_TAKEN', detail: 'An account with that email already exists.' },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ email, name, passwordHash }).returning();
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

  return NextResponse.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { status: 201, headers: { 'cache-control': 'no-store' } },
  );
}
