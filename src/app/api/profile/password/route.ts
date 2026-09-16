import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { readSessionToken, requireUser } from '@/auth/cookies';
import { hashPassword, verifyPassword } from '@/auth/password';
import { deleteOtherSessionsForUser } from '@/auth/session';
import { MIN_PASSWORD_LENGTH } from '@/auth/validation';
import { db } from '@/db/client';
import { users } from '@/db/schema';

/**
 * Changes the signed-in account's own password. `requireUser()` first, same
 * as every other `/api/profile/*` route — the target is always the caller's
 * own row, never one taken from the request body.
 *
 * `currentPassword` is required and checked *unless* the account has no
 * password yet (`passwordHash` null — a Google-only account): there's
 * nothing to prove knowledge of in that case, so this doubles as "add a
 * password to my Google account" without a separate endpoint.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChangePasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

function badRequest(code: string, detail: string): NextResponse {
  return NextResponse.json({ code, detail }, { status: 400 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  let body: ChangePasswordBody;
  try {
    body = (await request.json()) as ChangePasswordBody;
  } catch {
    return badRequest('INVALID_JSON', 'The request body is not valid JSON.');
  }

  const currentPassword = body.currentPassword ?? '';
  const newPassword = body.newPassword ?? '';

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return badRequest('WEAK_PASSWORD', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (user.passwordHash) {
    const currentOk = currentPassword && (await verifyPassword(currentPassword, user.passwordHash));
    if (!currentOk) return badRequest('INCORRECT_PASSWORD', 'Your current password is incorrect.');
  }

  const newPasswordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash: newPasswordHash, updatedAt: new Date() }).where(eq(users.id, user.id));

  // Other devices/browsers holding a session are signed out; this one isn't
  // — it just proved it's the account owner by typing the current password
  // (or there wasn't one to prove), so there's no reason to log itself out.
  const currentToken = await readSessionToken();
  if (currentToken) await deleteOtherSessionsForUser(user.id, currentToken);

  return NextResponse.json({ changed: true }, { headers: { 'cache-control': 'no-store' } });
}
