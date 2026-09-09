import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
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

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(userId: string): Promise<CreatedSession> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionDurationMs());

  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
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
