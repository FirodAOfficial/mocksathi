import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { sessions, users, type User } from '@/db/schema';

/**
 * Session storage.
 *
 * DB-backed rather than a signed/stateless token, so logout is a real delete
 * — a JWT-style token would stay valid until it expired regardless of what
 * the "logout" button did. Only a hash of the token is ever stored (see
 * `sessions.id` in `src/db/schema.ts`); the raw token lives only in the
 * browser's cookie, set by `src/auth/cookies.ts`.
 */

const DEFAULT_SESSION_DURATION_HOURS = 1;

/**
 * How long a session lasts, read fresh on every call rather than cached at
 * module load — so tests (and a running dev server, on restart) pick up an
 * env change without needing a code edit.
 */
export function sessionDurationMs(): number {
  const raw = process.env.SESSION_DURATION_HOURS;
  const hours = raw ? Number(raw) : DEFAULT_SESSION_DURATION_HOURS;
  return (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_SESSION_DURATION_HOURS) * 60 * 60 * 1000;
}

const DEFAULT_MAX_CONCURRENT_SESSIONS = 5;

/** How many *live* sessions one user may hold at once — same "read fresh" reasoning as `sessionDurationMs`. */
export function maxConcurrentSessions(): number {
  const raw = process.env.MAX_CONCURRENT_SESSIONS;
  const value = raw ? Number(raw) : DEFAULT_MAX_CONCURRENT_SESSIONS;
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_CONCURRENT_SESSIONS;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/**
 * Creates a session, evicting the user's oldest live session(s) first if
 * they're already at the cap — signing in on a sixth device (default cap: 5)
 * quietly signs the oldest one out, rather than growing the sessions table
 * without bound or refusing the new login outright. Already-expired sessions
 * don't count against the cap (or get touched here) — they're dead weight,
 * not a live session occupying a slot; nothing currently sweeps them, same
 * as before this change.
 */
export async function createSession(userId: string): Promise<CreatedSession> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionDurationMs());
  const cap = maxConcurrentSessions();

  await db.transaction(async (tx) => {
    const live = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
      .orderBy(asc(sessions.createdAt));

    // Adding one more would exceed the cap — evict the oldest live sessions
    // until there's exactly room for it.
    const overflow = live.length - cap + 1;
    if (overflow > 0) {
      const toEvict = live.slice(0, overflow).map((row) => row.id);
      await tx.delete(sessions).where(inArray(sessions.id, toEvict));
    }

    await tx.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  });

  return { token, expiresAt };
}

/** The session's user, or `null` if the token is missing, unknown, or expired. */
export async function getUserBySessionToken(token: string): Promise<User | null> {
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return row?.user ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}
