import 'server-only';
import { createHash } from 'node:crypto';

/**
 * The requester's address, and a way to record it without storing it.
 *
 * Shared by every OTP flow (`emailVerification.ts`, `passwordReset.ts`) that
 * stamps an `ipHash` column for abuse investigation — pulled out once both
 * needed the same four lines `signup/route.ts` and `verify-email/request/
 * route.ts` already had.
 */

/**
 * `x-forwarded-for` is a list when proxies chain; the first entry is the
 * client. Absent locally, which is why callers tolerate a null ip.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? null;
}

/** SHA-256 of an IP, so the per-address record needs no memory of where. */
export function hashIp(ip: string | null): string | null {
  return ip ? createHash('sha256').update(ip).digest('hex') : null;
}
