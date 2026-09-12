import 'server-only';
import { createHash } from 'node:crypto';
import { OTP_TTL_MS } from '@/auth/otpPolicy';
import { otpEmailContent, type OtpPurpose } from './otpEmail';
import { VERIFY_FROM, resend } from './resend';

/**
 * The single place a verification email is sent.
 *
 * Centralised so no route calls Resend directly: the From address, the
 * template, the error handling and the logging are one decision each, not one
 * per caller.
 *
 * Returns a typed result rather than throwing, matching how `src/db/
 * enrollments.ts` reports a refusal. Resend's own error object never leaves
 * this module — a provider message can name the account, the domain, or the
 * reason a recipient was suppressed, none of which belongs in an HTTP response.
 */

export type SendFailure =
  /** Resend accepted the request but reported an error, or the call threw. */
  | 'provider_rejected'
  /** The key is missing, so the client could not even be constructed. */
  | 'not_configured';

export type SendResult = { ok: true; id: string } | { ok: false; reason: SendFailure };

export interface SendOtpEmailOptions {
  to: string;
  code: string;
  purpose: OtpPurpose;
}

/**
 * A short digest of the address, for logs.
 *
 * Enough to correlate two log lines about the same recipient or to match a
 * support report, without writing an email address into a log aggregator.
 */
function recipientTag(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
}

export async function sendOtpEmail({ to, code, purpose }: SendOtpEmailOptions): Promise<SendResult> {
  const tag = recipientTag(to);
  const { subject, html, text } = otpEmailContent({
    code,
    purpose,
    expiresInMinutes: Math.round(OTP_TTL_MS / 60_000),
  });

  /*
   * The first server-side logging in this codebase.
   *
   * `src/` had no `console.*` anywhere and no logger: the house style is a
   * typed failure result, not a log line. Delivery is the case that needs one
   * anyway — when a candidate says no email arrived, the only way to tell "we
   * never asked Resend" from "Resend refused it" is a record of the attempt,
   * and the request id is what Resend's own dashboard is searched by.
   *
   * Never logged: the code itself, the API key, or the raw address.
   */
  try {
    const result = await resend().emails.send({ from: VERIFY_FROM, to, subject, html, text });

    if (result.error) {
      console.error('[email] otp send rejected', {
        purpose,
        recipient: tag,
        name: result.error.name,
      });
      return { ok: false, reason: 'provider_rejected' };
    }

    const id = result.data?.id;
    if (!id) {
      // A success with no id should not happen; treating it as a failure is
      // safer than reporting a delivery that cannot be traced.
      console.error('[email] otp send returned no id', { purpose, recipient: tag });
      return { ok: false, reason: 'provider_rejected' };
    }

    console.info('[email] otp sent', { purpose, recipient: tag, resendId: id });
    return { ok: true, id };
  } catch (error) {
    // Thrown rather than returned: a missing key, or the network. The two are
    // told apart because only the accessor throws with that message.
    const notConfigured = error instanceof Error && error.message.startsWith('RESEND_API_KEY');
    console.error('[email] otp send failed', {
      purpose,
      recipient: tag,
      reason: notConfigured ? 'not_configured' : 'request_failed',
    });

    return { ok: false, reason: notConfigured ? 'not_configured' : 'provider_rejected' };
  }
}
