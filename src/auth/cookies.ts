import 'server-only';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { getUserBySessionToken, type CreatedSession } from './session';
import type { User } from '@/db/schema';

/** Next.js-specific glue between the session store and the browser cookie. */

export const SESSION_COOKIE_NAME = 'mocksathi_session';

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
 * Like `requireUser`, but for admin-only pages and routes: a signed-in
 * non-admin gets a 404, not a redirect — that says "this doesn't exist"
 * rather than "you're not allowed", which leaks less about what's here.
 * Route handlers must call this too, not just the pages that link to them —
 * a page-level check alone doesn't stop someone hitting the API directly.
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'admin') notFound();
  return user;
}
