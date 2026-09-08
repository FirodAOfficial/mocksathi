/**
 * Postgres error codes, as seen through drizzle-orm.
 *
 * drizzle wraps the driver's error in its own `DrizzleQueryError`, with the
 * original `pg` error (the one that actually carries `.code`) attached as
 * `.cause` — so `error.code` is `undefined` and this needs to check both.
 */

const UNIQUE_VIOLATION = '23505';

function pgCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === 'string') return direct;

  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === 'object' && cause !== null) {
    const causeCode = (cause as { code?: unknown }).code;
    if (typeof causeCode === 'string') return causeCode;
  }
  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return pgCode(error) === UNIQUE_VIOLATION;
}
