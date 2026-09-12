import 'server-only';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { getUserBySessionToken, type CreatedSession } from './session';
import type { User } from '@/db/schema';

/** Next.js-specific glue between the session store and the browser cookie. */

export const SESSION_COOKIE_NAME = 'mocksathi_session';
/** CSRF token for the Google OAuth round trip — short-lived, cleared as soon as the callback reads it. */
export const GOOGLE_STATE_COOKIE_NAME = 'mocksathi_google_state';

export async function setSessionCookie(session: CreatedSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function readSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

/** Stashes the CSRF `state` before redirecting to Google — 10 minutes is generous for a consent-screen round trip. */
export async function setGoogleStateCookie(state: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
}

/** Reads and clears the state cookie in one step — it's single-use, so nothing should read it twice. */
export async function consumeGoogleStateCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const value = cookieStore.get(GOOGLE_STATE_COOKIE_NAME)?.value;
  cookieStore.delete(GOOGLE_STATE_COOKIE_NAME);
  return value;
}

/**
 * The signed-in user for the current request, or `null` if not signed in.
 *
 * Wrapped in React's `cache()`: every `/dashboard/*` layout and page calls
 * this independently (there's no prop channel from a layout to its page), so
 * without memoising, a request that renders both would look the session up
 * twice. `cache()` dedupes it to one DB round trip per request.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  return getUserBySessionToken(token);
});

/** Like `getCurrentUser`, but sends a signed-out visitor to `/login` instead of returning `null`. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Like `requireUser`, but also insists the email address has been verified.
 *
 * An unverified account is sent to `/verify-email`, where the emailed code is
 * entered. Applied at the page chokepoints — `/dashboard`'s layout covers every
 * route beneath it — rather than inside `requireUser`, because the two
 * verification routes and `/api/auth/me` have to remain reachable to an
 * unverified session or there is no way out of the gate.
 *
 * Accounts that predate verification were backfilled as verified by migration
 * `0008`; without that, this would lock out every existing user at once.
 */
export async function requireVerifiedUser(): Promise<User> {
  const user = await requireUser();
  if (!user.emailVerifiedAt) redirect('/verify-email');
  return user;
}

/**
 * Like `requireUser`, but for admin-only pages and routes: a signed-in
 * non-admin gets a 404, not a redirect — that says "this doesn't exist"
 * rather than "you're not allowed", which leaks less about what's here.
 * Route handlers must call this too, not just the pages that link to them —
 * a page-level check alone doesn't stop someone hitting the API directly.
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireVerifiedUser();
  if (user.role !== 'admin') notFound();
  return user;
}
