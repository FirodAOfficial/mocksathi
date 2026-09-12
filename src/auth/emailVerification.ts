import 'server-only';
import { createHash } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { sendOtpEmail } from '@/email/sendOtpEmail';
import { db } from '@/db/client';
import { emailVerificationCodes, users, type User } from '@/db/schema';
import { hashPassword, verifyPassword } from './password';
import {
  OTP_MAX_ATTEMPTS,
  OTP_WINDOW_MS,
  generateOtp,
  isExhausted,
  otpExpiryFrom,
  requestDecision,
  verifyDecision,
} from './otpPolicy';

/**
 * Issuing and checking email-verification codes.
 *
 * The database half of the flow; the rules themselves live in `otpPolicy.ts`,
 * which is pure and therefore testable. This module composes the two and owns
 * the ordering decisions — what is written before the email goes out, and what
 * is written when it does not.
 */

export type IssueResult =
  | { ok: true }
  | { ok: false; reason: 'already_verified' }
  | { ok: false; reason: 'cooldown'; retryAfterSeconds: number }
  | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }
  | { ok: false; reason: 'email_failed' };

export type ConfirmResult =
  | { ok: true }
  | { ok: false; reason: 'already_verified' }
  | { ok: false; reason: 'no_code' }
  | { ok: false; reason: 'expired' }
  | { ok: false; reason: 'too_many_attempts' }
  | { ok: false; reason: 'mismatch'; attemptsRemaining: number };

/** SHA-256 of an IP, so the per-address limit needs no record of where. */
export function hashIp(ip: string | null): string | null {
  return ip ? createHash('sha256').update(ip).digest('hex') : null;
}

const seconds = (ms: number): number => Math.max(1, Math.ceil(ms / 1000));

/**
 * Issues a code and emails it.
 *
 * The order matters and is the answer to "never report a delivery that did not
 * happen":
 *
 * 1. Check the limits first, so a refusal costs no code and no email.
 * 2. Write the new row and consume every older one in **one transaction** — the
 *    moment a replacement exists, the previous code stops working, and there is
 *    no instant where both are live.
 * 3. Send. On failure, consume the row just written. Nothing usable survives,
 *    but the row stays and still counts against the window: a provider outage
 *    must not hand back an unlimited allowance at the moment it is being
 *    leaned on.
 *
 * The send is outside the transaction on purpose. Holding a Postgres
 * transaction open across a third-party HTTP call pins a pooled connection for
 * the length of someone else's outage.
 */
export async function issueVerificationCode(user: User, ipHash: string | null): Promise<IssueResult> {
  if (user.emailVerifiedAt) return { ok: false, reason: 'already_verified' };

  const now = new Date();
  const windowStart = new Date(now.getTime() - OTP_WINDOW_MS);

  const recent = await db
    .select({
      createdAt: emailVerificationCodes.createdAt,
      expiresAt: emailVerificationCodes.expiresAt,
      attempts: emailVerificationCodes.attempts,
      consumedAt: emailVerificationCodes.consumedAt,
    })
    .from(emailVerificationCodes)
    .where(and(eq(emailVerificationCodes.userId, user.id), gt(emailVerificationCodes.createdAt, windowStart)))
    .orderBy(desc(emailVerificationCodes.createdAt));

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
      .update(emailVerificationCodes)
      .set({ consumedAt: now })
      .where(and(eq(emailVerificationCodes.userId, user.id), isNull(emailVerificationCodes.consumedAt)));

    const [row] = await tx
      .insert(emailVerificationCodes)
      .values({ userId: user.id, codeHash, expiresAt: otpExpiryFrom(now), ipHash })
      .returning({ id: emailVerificationCodes.id });

    return row?.id;
  });

  if (!issuedId) return { ok: false, reason: 'email_failed' };

  const sent = await sendOtpEmail({ to: user.email, code, purpose: 'email-verification' });
  if (!sent.ok) {
    await db
      .update(emailVerificationCodes)
      .set({ consumedAt: new Date() })
      .where(eq(emailVerificationCodes.id, issuedId));

    return { ok: false, reason: 'email_failed' };
  }

  return { ok: true };
}

/**
 * Checks a code and, on a match, marks the address verified.
 *
 * A wrong guess is recorded before anything is returned, and the fifth one
 * consumes the row in the same write — so a dead code is dead immediately
 * rather than at whatever point the next request happens to look at it.
 */
export async function confirmVerificationCode(user: User, code: string): Promise<ConfirmResult> {
  if (user.emailVerifiedAt) return { ok: false, reason: 'already_verified' };

  const [record] = await db
    .select()
    .from(emailVerificationCodes)
    .where(eq(emailVerificationCodes.userId, user.id))
    .orderBy(desc(emailVerificationCodes.createdAt))
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
      .update(emailVerificationCodes)
      .set({ attempts, ...(exhausted ? { consumedAt: now } : {}) })
      .where(eq(emailVerificationCodes.id, record.id));

    if (exhausted) return { ok: false, reason: 'too_many_attempts' };
    return { ok: false, reason: 'mismatch', attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - attempts) };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(emailVerificationCodes)
      .set({ consumedAt: now })
      .where(eq(emailVerificationCodes.id, record.id));

    await tx.update(users).set({ emailVerifiedAt: now, updatedAt: now }).where(eq(users.id, user.id));
  });

  return { ok: true };
}
