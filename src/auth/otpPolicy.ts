import { randomInt } from 'node:crypto';

/**
 * The rules a verification code obeys: how it is generated, how long it lives,
 * how often one may be asked for, and how many guesses it survives.
 *
 * Pure by design. Every decision takes the current time as an argument rather
 * than reading the clock, and none of it touches the database — which is what
 * makes the boundaries (is 59 seconds still inside the cooldown? is the fifth
 * wrong guess the one that kills the code?) testable at all. This repository
 * has no test database, so logic that could only be exercised through Postgres
 * would in practice be exercised by nobody.
 */

/** Digits in a code. Six is what a person will retype from their phone. */
export const OTP_LENGTH = 6;

/** How long a code stays usable. */
export const OTP_TTL_MS = 10 * 60 * 1000;

/**
 * Wrong guesses a code survives.
 *
 * The fifth failure destroys it. Without this, six digits is a million
 * guesses — minutes of scripted requests against a ten-minute window.
 */
export const OTP_MAX_ATTEMPTS = 5;

/** Minimum gap between two requests, so "resend" cannot be held down. */
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

/** Codes one account may request inside `OTP_WINDOW_MS`. */
export const OTP_MAX_PER_WINDOW = 5;
export const OTP_WINDOW_MS = 15 * 60 * 1000;

/**
 * A six-digit code from a cryptographically secure source.
 *
 * `randomInt`, never `Math.random()` — that is seeded predictably and is not
 * meant for anything an attacker benefits from guessing.
 *
 * The range is `[0, 1000000)` with zero padding, deliberately not
 * `randomInt(100000, 1000000)`. The latter reads like it produces a six-digit
 * number, and it does, but it can never produce one beginning with `0` — which
 * throws away a tenth of the keyspace and tells an attacker the first digit is
 * never zero.
 */
export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

/** What a stored code looks like to the policy. */
export interface CodeRecord {
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
}

export type RequestDecision =
  | { kind: 'ok' }
  /** Asked again too soon; `retryAfterMs` is what to tell the caller to wait. */
  | { kind: 'cooldown'; retryAfterMs: number }
  /** Too many in the window; `retryAfterMs` is until the oldest one ages out. */
  | { kind: 'rate_limited'; retryAfterMs: number };

/**
 * Whether another code may be issued.
 *
 * `recent` is every code issued to this account inside `OTP_WINDOW_MS`,
 * newest first. Both limits are counted from *requests*, not from successful
 * deliveries: a provider outage must not reset someone's allowance, or the
 * limit disappears exactly when it is being leaned on.
 */
export function requestDecision(recent: readonly CodeRecord[], now: Date): RequestDecision {
  const newest = recent[0];

  if (newest) {
    const since = now.getTime() - newest.createdAt.getTime();
    if (since < OTP_RESEND_COOLDOWN_MS) {
      return { kind: 'cooldown', retryAfterMs: OTP_RESEND_COOLDOWN_MS - since };
    }
  }

  const inWindow = recent.filter((code) => now.getTime() - code.createdAt.getTime() < OTP_WINDOW_MS);
  if (inWindow.length >= OTP_MAX_PER_WINDOW) {
    const oldest = inWindow[inWindow.length - 1]!;
    const retryAfterMs = OTP_WINDOW_MS - (now.getTime() - oldest.createdAt.getTime());
    return { kind: 'rate_limited', retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  return { kind: 'ok' };
}

export type VerifyDecision =
  /** The record is live; the digits still have to match. */
  | { kind: 'checkable' }
  | { kind: 'expired' }
  /** Already used, superseded by a newer code, or killed by a failed send. */
  | { kind: 'consumed' }
  | { kind: 'too_many_attempts' };

/**
 * Whether a stored code is even worth comparing against.
 *
 * Checked before the hash comparison so an expired or exhausted code costs no
 * scrypt work, and so a caller cannot spend attempts on a record that was
 * already dead.
 */
export function verifyDecision(code: CodeRecord, now: Date): VerifyDecision {
  if (code.consumedAt !== null) return { kind: 'consumed' };
  if (code.attempts >= OTP_MAX_ATTEMPTS) return { kind: 'too_many_attempts' };
  if (code.expiresAt.getTime() <= now.getTime()) return { kind: 'expired' };
  return { kind: 'checkable' };
}

/**
 * Whether this wrong guess was the last one the code gets.
 *
 * Called with the attempt count *after* incrementing, so the caller can
 * consume the record in the same write rather than leaving a dead code live
 * until the next request touches it.
 */
export function isExhausted(attemptsAfterFailure: number): boolean {
  return attemptsAfterFailure >= OTP_MAX_ATTEMPTS;
}

/** When a code issued now should stop working. */
export function otpExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + OTP_TTL_MS);
}
