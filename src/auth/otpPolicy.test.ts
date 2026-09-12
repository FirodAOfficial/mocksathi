import { describe, expect, it } from 'vitest';
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_WINDOW,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  generateOtp,
  isExhausted,
  otpExpiryFrom,
  requestDecision,
  verifyDecision,
  type CodeRecord,
} from './otpPolicy';

/**
 * The boundaries of the verification-code rules.
 *
 * These are the tests that can exist: the policy is pure, so "is 59 seconds
 * still inside the cooldown" is answerable without a database — which this
 * repository does not have in tests.
 */

const NOW = new Date('2026-09-12T10:00:00.000Z');

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

function code(overrides: Partial<CodeRecord> = {}): CodeRecord {
  return {
    createdAt: NOW,
    expiresAt: otpExpiryFrom(NOW),
    attempts: 0,
    consumedAt: null,
    ...overrides,
  };
}

describe('generateOtp', () => {
  it('produces exactly six digits', () => {
    for (let draw = 0; draw < 200; draw += 1) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });

  it('can produce a code that starts with zero', () => {
    // `randomInt(100000, 1000000)` reads like it produces a six-digit number
    // and does — but never one beginning with 0, throwing away a tenth of the
    // keyspace. Over 4000 draws, a leading zero is all but certain; its
    // absence would mean the range is wrong.
    const draws = Array.from({ length: 4000 }, generateOtp);

    expect(draws.some((value) => value.startsWith('0'))).toBe(true);
  });

  it('does not repeat itself over many draws', () => {
    // A stuck or predictable source would show up as collisions well above
    // what a million-wide keyspace produces by chance.
    const draws = new Set(Array.from({ length: 500 }, generateOtp));

    expect(draws.size).toBeGreaterThan(480);
  });
});

describe('requestDecision — resend cooldown', () => {
  it('allows the first ever request', () => {
    expect(requestDecision([], NOW)).toEqual({ kind: 'ok' });
  });

  it('refuses a second request one second inside the cooldown', () => {
    const decision = requestDecision([code({ createdAt: ago(OTP_RESEND_COOLDOWN_MS - 1000) })], NOW);

    expect(decision.kind).toBe('cooldown');
    expect(decision.kind === 'cooldown' && decision.retryAfterMs).toBe(1000);
  });

  it('allows a request one second after the cooldown', () => {
    expect(requestDecision([code({ createdAt: ago(OTP_RESEND_COOLDOWN_MS + 1000) })], NOW)).toEqual({
      kind: 'ok',
    });
  });

  it('counts a failed send against the cooldown', () => {
    // The limits are counted from requests, not deliveries: a provider outage
    // must not hand back an unlimited allowance at the moment it is abused.
    const failed = code({ createdAt: ago(1000), consumedAt: ago(1000) });

    expect(requestDecision([failed], NOW).kind).toBe('cooldown');
  });
});

describe('requestDecision — window limit', () => {
  /** Five requests spread far enough apart to clear the cooldown each time. */
  const fiveInWindow = Array.from({ length: OTP_MAX_PER_WINDOW }, (_, index) =>
    code({ createdAt: ago(120_000 * (index + 1)) }),
  );

  it('refuses the sixth request inside the window', () => {
    const decision = requestDecision(fiveInWindow, NOW);

    expect(decision.kind).toBe('rate_limited');
    expect(decision.kind === 'rate_limited' && decision.retryAfterMs).toBeGreaterThan(0);
  });

  it('allows the fifth', () => {
    expect(requestDecision(fiveInWindow.slice(1), NOW)).toEqual({ kind: 'ok' });
  });

  it('ignores requests that have aged out of the window', () => {
    const old = fiveInWindow.map(() => code({ createdAt: ago(60 * 60 * 1000) }));

    expect(requestDecision(old, NOW)).toEqual({ kind: 'ok' });
  });

  it('reports the cooldown first when both limits are hit', () => {
    // The caller is told the shorter wait, not the longer one.
    const justNow = [code({ createdAt: ago(1000) }), ...fiveInWindow];

    expect(requestDecision(justNow, NOW).kind).toBe('cooldown');
  });
});

describe('verifyDecision', () => {
  it('accepts a fresh unused code for checking', () => {
    expect(verifyDecision(code(), NOW)).toEqual({ kind: 'checkable' });
  });

  it('accepts a code one second before it expires', () => {
    expect(verifyDecision(code({ expiresAt: new Date(NOW.getTime() + 1000) }), NOW).kind).toBe(
      'checkable',
    );
  });

  it('refuses a code one second after it expires', () => {
    expect(verifyDecision(code({ expiresAt: new Date(NOW.getTime() - 1000) }), NOW)).toEqual({
      kind: 'expired',
    });
  });

  it('refuses a code at the exact expiry instant', () => {
    // `<=`, not `<`: a code whose lifetime has run out is not usable on the
    // final millisecond of it.
    expect(verifyDecision(code({ expiresAt: NOW }), NOW)).toEqual({ kind: 'expired' });
  });

  it('refuses a consumed code even while unexpired', () => {
    // This is what makes a resent code invalidate its predecessor.
    expect(verifyDecision(code({ consumedAt: NOW }), NOW)).toEqual({ kind: 'consumed' });
  });

  it('refuses a code that has used up its attempts', () => {
    expect(verifyDecision(code({ attempts: OTP_MAX_ATTEMPTS }), NOW)).toEqual({
      kind: 'too_many_attempts',
    });
  });

  it('still checks a code with one attempt left', () => {
    expect(verifyDecision(code({ attempts: OTP_MAX_ATTEMPTS - 1 }), NOW).kind).toBe('checkable');
  });

  it('reports consumed ahead of expired', () => {
    // Both are dead ends, but "already used" is the truer answer and costs no
    // scrypt work either way.
    const both = code({ consumedAt: NOW, expiresAt: new Date(NOW.getTime() - 1000) });

    expect(verifyDecision(both, NOW)).toEqual({ kind: 'consumed' });
  });
});

describe('isExhausted', () => {
  it('is the fifth wrong guess that kills the code', () => {
    expect(isExhausted(OTP_MAX_ATTEMPTS - 1)).toBe(false);
    expect(isExhausted(OTP_MAX_ATTEMPTS)).toBe(true);
  });
});

describe('otpExpiryFrom', () => {
  it('is ten minutes out', () => {
    expect(otpExpiryFrom(NOW).getTime() - NOW.getTime()).toBe(OTP_TTL_MS);
    expect(OTP_TTL_MS).toBe(10 * 60 * 1000);
  });

  it('keeps the advertised code length in step with the generator', () => {
    expect(generateOtp()).toHaveLength(OTP_LENGTH);
  });
});
