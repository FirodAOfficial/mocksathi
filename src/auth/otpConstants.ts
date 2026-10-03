/**
 * The verification-code numbers the browser also needs (code length, expiry,
 * attempts) — split out of `otpPolicy.ts` so a client form can import them
 * without pulling in `node:crypto`. Bundled for the browser, that import
 * became a ~100 KB crypto polyfill on `/forgot-password` and `/verify-email`.
 * `otpPolicy.ts` re-exports all of these; server code can keep importing from
 * there.
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
