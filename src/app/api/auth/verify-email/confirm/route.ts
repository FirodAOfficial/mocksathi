import { NextResponse } from 'next/server';
import { requireUser } from '@/auth/cookies';
import { confirmVerificationCode } from '@/auth/emailVerification';
import { OTP_LENGTH } from '@/auth/otpPolicy';

/**
 * Checks a verification code and, on a match, marks the address verified.
 *
 * `requireUser`, not `requireVerifiedUser`, for the same reason as the request
 * route: an unverified session has to be able to get through the gate.
 *
 * The failure reasons are reported distinctly — expired, exhausted, wrong —
 * because the caller is authenticated and the code is their own. Blurring them
 * would only make a real user retype a code that was never going to work.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ConfirmBody {
  code?: string;
}

function badRequest(code: string, detail: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ code, detail, ...extra }, { status: 400 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return badRequest('INVALID_JSON', 'The request body is not valid JSON.');
  }

  // Spaces and dashes stripped: people paste "048 261" out of an email.
  const code = (body.code ?? '').replace(/[\s-]/g, '');
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
    return badRequest('INVALID_CODE', `Enter the ${OTP_LENGTH}-digit code from your email.`);
  }

  const result = await confirmVerificationCode(user, code);

  if (result.ok) {
    return NextResponse.json({ verified: true }, { headers: { 'cache-control': 'no-store' } });
  }

  switch (result.reason) {
    case 'already_verified':
      return NextResponse.json({ verified: true }, { headers: { 'cache-control': 'no-store' } });

    case 'no_code':
      return badRequest('NO_CODE', 'That code is no longer valid. Ask for a new one.');

    case 'expired':
      return badRequest('CODE_EXPIRED', 'That code has expired. Ask for a new one.');

    case 'too_many_attempts':
      return badRequest(
        'TOO_MANY_ATTEMPTS',
        'Too many incorrect attempts. Ask for a new code.',
      );

    case 'mismatch':
      return badRequest('INVALID_CODE', 'That code is not correct.', {
        attemptsRemaining: result.attemptsRemaining,
      });
  }
}
