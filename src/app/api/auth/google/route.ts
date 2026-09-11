import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { setGoogleStateCookie } from '@/auth/cookies';
import { googleAuthorizationUrl, googleRedirectUri } from '@/auth/google';

/** Starts the "Continue with Google" flow — a plain navigation, not fetched by the client. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const state = randomBytes(24).toString('base64url');
  await setGoogleStateCookie(state);

  const redirectUri = googleRedirectUri(request.nextUrl.origin);
  return NextResponse.redirect(googleAuthorizationUrl(state, redirectUri));
}
