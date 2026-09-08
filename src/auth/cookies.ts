import 'server-only';
import { cookies } from 'next/headers';
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

/** The signed-in user for the current request, or `null` if not signed in. */
export async function getCurrentUser(): Promise<User | null> {
  const token = await readSessionToken();
  if (!token) return null;
  return getUserBySessionToken(token);
}
