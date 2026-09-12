import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/auth/cookies';
import { hashIp, issueVerificationCode } from '@/auth/emailVerification';

/**
 * Sends a verification code to the signed-in account's own address.
 *
 * `requireUser`, not `requireVerifiedUser` — this is the way out of the gate,
 * so an unverified session must be able to reach it.
 *
 * Account enumeration does not apply here, which is why the responses can be
 * specific. The caller already holds a session, so the address is one they have
 * proved they can sign in to; no answer this route gives reveals anything about
 * anybody else's account.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The requester's address, as Vercel reports it.
 *
 * `x-forwarded-for` is a list when proxies chain; the first entry is the client.
 * Absent locally, which is why the per-address limit tolerates null rather than
 * refusing the request.
 */
function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await requireUser();
  const result = await issueVerificationCode(user, hashIp(clientIp(request)));

  if (result.ok) {
    return NextResponse.json({ sent: true }, { headers: { 'cache-control': 'no-store' } });
  }

  switch (result.reason) {
    case 'already_verified':
      return NextResponse.json(
        { code: 'ALREADY_VERIFIED', detail: 'Your email address is already verified.' },
        { status: 409 },
      );

    case 'cooldown':
      return NextResponse.json(
        {
          code: 'VERIFICATION_COOLDOWN',
          detail: `Wait ${result.retryAfterSeconds} seconds before asking for another code.`,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        // `Retry-After` as well as the body: it is the standard header for
        // this, and a client can honour it without parsing our JSON.
        { status: 429, headers: { 'retry-after': String(result.retryAfterSeconds) } },
      );

    case 'rate_limited':
      return NextResponse.json(
        {
          code: 'VERIFICATION_RATE_LIMITED',
          detail: 'Too many codes requested. Try again later.',
          retryAfterSeconds: result.retryAfterSeconds,
        },
        { status: 429, headers: { 'retry-after': String(result.retryAfterSeconds) } },
      );

    case 'email_failed':
      // 502, as the avatar route does for a Supabase Storage failure: the
      // request was fine, the third party was not. Nothing from Resend's error
      // crosses this boundary — it is logged in `sendOtpEmail` instead.
      return NextResponse.json(
        {
          code: 'VERIFICATION_EMAIL_FAILED',
          detail: 'Could not send the verification email. Try again in a moment.',
        },
        { status: 502 },
      );
  }
}
