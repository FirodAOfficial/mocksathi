import { NextResponse, type NextRequest } from 'next/server';
import { consumeGoogleStateCookie, setSessionCookie } from '@/auth/cookies';
import { exchangeGoogleCode, fetchGoogleUserInfo, googleRedirectUri } from '@/auth/google';
import { createSession } from '@/auth/session';
import { findOrCreateUserByGoogle } from '@/db/googleAuth';
import { subscribeUserToDefaultPlan } from '@/db/plans';

/**
 * Where Google sends the browser back to after the consent screen.
 *
 * Necessarily unauthenticated — there's no session yet, that's the point of
 * this route — but it does touch the database (finds or creates a `users`
 * row), so it earns a row in the auth-security-review skill's public-routes
 * table alongside `POST /api/auth/login`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function failure(origin: string, reason: string): NextResponse {
  return NextResponse.redirect(`${origin}/login?error=${reason}`);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expectedState = await consumeGoogleStateCookie();

  // Covers a missing/expired state cookie, a tampered `state` query param, and
  // Google redirecting back without a code at all (e.g. the user hit "Cancel"
  // on the consent screen, which arrives as `?error=access_denied` instead).
  if (!code || !state || !expectedState || state !== expectedState) {
    return failure(origin, 'google_state_mismatch');
  }

  let accessToken: string;
  try {
    accessToken = await exchangeGoogleCode(code, googleRedirectUri(origin));
  } catch {
    return failure(origin, 'google_exchange_failed');
  }

  let profile;
  try {
    profile = await fetchGoogleUserInfo(accessToken);
  } catch {
    return failure(origin, 'google_profile_failed');
  }

  // Google only reports an email as verified once its own checks pass; an
  // unverified one isn't trustworthy enough to link an account by.
  if (!profile.email_verified) {
    return failure(origin, 'google_email_unverified');
  }

  const { user, isNewUser } = await findOrCreateUserByGoogle(profile);

  // Only a brand-new account starts on the default plan — never re-run for an
  // existing user, or a real subscriber signing in would get silently
  // downgraded back to free every time they use Google to log in.
  if (isNewUser) await subscribeUserToDefaultPlan(user.id);

  const session = await createSession(user.id);
  await setSessionCookie(session);

  return NextResponse.redirect(`${origin}/dashboard`);
}
