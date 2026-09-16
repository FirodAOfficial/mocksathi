import 'server-only';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { sendOtpEmail } from '@/email/sendOtpEmail';
import { db } from '@/db/client';
import { passwordResetCodes, users, type User } from '@/db/schema';
import { hashPassword, verifyPassword } from './password';
import { deleteAllSessionsForUser } from './session';
import { OTP_WINDOW_MS, generateOtp, isExhausted, otpExpiryFrom, requestDecision, verifyDecision } from './otpPolicy';

/**
 * Issuing and checking password-reset codes.
 *
 * The unauthenticated sibling of `emailVerification.ts` — same table shape,
 * same `otpPolicy.ts` rules, composed the same way (limits checked first,
 * the row written and superseded in one transaction, the send outside it).
 * What differs: there's no session yet when this starts (the caller proves
 * nothing but knowing an email address, which is why the routes calling this
 * must respond identically whether or not that address has an account — see
 * `POST /api/auth/forgot-password`), and success overwrites `passwordHash`
 * and kills every existing session rather than flipping a verified flag.
 */

export type IssueResult =
  | { ok: true }
  | { ok: false; reason: 'cooldown'; retryAfterSeconds: number }
  | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }
  | { ok: false; reason: 'email_failed' };

export type ConfirmResult =
  | { ok: true }
  | { ok: false; reason: 'no_code' }
  | { ok: false; reason: 'expired' }
  | { ok: false; reason: 'too_many_attempts' }
  | { ok: false; reason: 'mismatch' };

const seconds = (ms: number): number => Math.max(1, Math.ceil(ms / 1000));

/** Issues a reset code and emails it. See `emailVerification.ts#issueVerificationCode` for the shape this mirrors. */
export async function issuePasswordResetCode(user: User, ipHash: string | null): Promise<IssueResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - OTP_WINDOW_MS);

  const recent = await db
    .select({
      createdAt: passwordResetCodes.createdAt,
      expiresAt: passwordResetCodes.expiresAt,
      attempts: passwordResetCodes.attempts,
      consumedAt: passwordResetCodes.consumedAt,
    })
    .from(passwordResetCodes)
    .where(and(eq(passwordResetCodes.userId, user.id), gt(passwordResetCodes.createdAt, windowStart)))
    .orderBy(desc(passwordResetCodes.createdAt));

  const decision = requestDecision(recent, now);
  if (decision.kind === 'cooldown') {
    return { ok: false, reason: 'cooldown', retryAfterSeconds: seconds(decision.retryAfterMs) };
  }
  if (decision.kind === 'rate_limited') {
    return { ok: false, reason: 'rate_limited', retryAfterSeconds: seconds(decision.retryAfterMs) };
  }

  const code = generateOtp();
  const codeHash = await hashPassword(code);

  const issuedId = await db.transaction(async (tx) => {
    await tx
      .update(passwordResetCodes)
      .set({ consumedAt: now })
      .where(and(eq(passwordResetCodes.userId, user.id), isNull(passwordResetCodes.consumedAt)));

    const [row] = await tx
      .insert(passwordResetCodes)
      .values({ userId: user.id, codeHash, expiresAt: otpExpiryFrom(now), ipHash })
      .returning({ id: passwordResetCodes.id });

    return row?.id;
  });

  if (!issuedId) return { ok: false, reason: 'email_failed' };

  const sent = await sendOtpEmail({ to: user.email, code, purpose: 'password-reset' });
  if (!sent.ok) {
    await db.update(passwordResetCodes).set({ consumedAt: new Date() }).where(eq(passwordResetCodes.id, issuedId));
    return { ok: false, reason: 'email_failed' };
  }

  return { ok: true };
}

/**
 * Checks a reset code and, on a match, replaces the password and signs every
 * session out.
 *
 * The reasons here are typed distinctly for testability, same as
 * `confirmVerificationCode` — but unlike that route, the HTTP layer calling
 * this one (`POST /api/auth/reset-password`) must collapse them into one
 * generic message. That route is unauthenticated, so telling a caller
 * "no_code" apart from "mismatch" would reveal whether the email they typed
 * has an account at all.
 */
export async function confirmPasswordReset(user: User, code: string, newPassword: string): Promise<ConfirmResult> {
  const [record] = await db
    .select()
    .from(passwordResetCodes)
    .where(eq(passwordResetCodes.userId, user.id))
    .orderBy(desc(passwordResetCodes.createdAt))
    .limit(1);

  if (!record) return { ok: false, reason: 'no_code' };

  const now = new Date();
  const state = verifyDecision(record, now);
  if (state.kind === 'expired') return { ok: false, reason: 'expired' };
  if (state.kind === 'consumed') return { ok: false, reason: 'no_code' };
  if (state.kind === 'too_many_attempts') return { ok: false, reason: 'too_many_attempts' };

  const matches = await verifyPassword(code, record.codeHash);

  if (!matches) {
    const attempts = record.attempts + 1;
    const exhausted = isExhausted(attempts);

    await db
      .update(passwordResetCodes)
      .set({ attempts, ...(exhausted ? { consumedAt: now } : {}) })
      .where(eq(passwordResetCodes.id, record.id));

    if (exhausted) return { ok: false, reason: 'too_many_attempts' };
    return { ok: false, reason: 'mismatch' };
  }

  const newPasswordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    await tx.update(passwordResetCodes).set({ consumedAt: now }).where(eq(passwordResetCodes.id, record.id));
    await tx.update(users).set({ passwordHash: newPasswordHash, updatedAt: now }).where(eq(users.id, user.id));
  });

  /*
   * Every open session is now untrusted. Confirming this code is a stronger
   * proof of ownership than any session already open — including one
   * opened by someone else, on a shared or compromised device, that the
   * real owner is taking the account back from. Unlike a change-password
   * from inside the app, there's no "current session" to spare here: this
   * route has none, so the fresh session the route creates after this call
   * returns is the only one that survives.
   */
  await deleteAllSessionsForUser(user.id);

  return { ok: true };
}
