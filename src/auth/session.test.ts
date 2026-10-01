import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Session policy: how long a sign-in lasts, and how many devices one account
 * may be signed into. The database is a fake that records what `createSession`
 * asks of it — enough to see which sessions a new sign-in evicts.
 */

const fake = vi.hoisted(() => ({
  /** Live sessions the user already has, oldest first. */
  live: [] as { id: string }[],
  evicted: [] as string[],
  inserted: [] as { id: string; userId: string; expiresAt: Date }[],
}));

vi.mock('drizzle-orm', async (importActual) => {
  const actual = await importActual<typeof import('drizzle-orm')>();
  return {
    ...actual,
    // Records which ids a delete was scoped to.
    inArray: (column: unknown, ids: string[]) => {
      fake.evicted.push(...ids);
      return actual.inArray(column as never, ids);
    },
  };
});

vi.mock('@/db/client', () => {
  const tx = {
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => Promise.resolve(fake.live) }) }) }),
    delete: () => ({ where: () => Promise.resolve() }),
    insert: () => ({
      values: (row: { id: string; userId: string; expiresAt: Date }) => {
        fake.inserted.push(row);
        return Promise.resolve();
      },
    }),
  };
  return { db: { transaction: (run: (t: typeof tx) => Promise<void>) => run(tx) } };
});

const { createSession, maxConcurrentSessions, sessionDurationMs } = await import('./session');

const DAY_MS = 24 * 60 * 60 * 1000;

describe('session policy', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env.SESSION_DURATION_HOURS;
    delete process.env.MAX_CONCURRENT_SESSIONS;
    fake.live = [];
    fake.evicted = [];
    fake.inserted = [];
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('lasts five days by default', () => {
    expect(sessionDurationMs()).toBe(5 * DAY_MS);
  });

  it('allows two devices at a time by default', () => {
    expect(maxConcurrentSessions()).toBe(2);
  });

  it('still honours the environment, and ignores nonsense in it', () => {
    process.env.SESSION_DURATION_HOURS = '2';
    process.env.MAX_CONCURRENT_SESSIONS = '3';
    expect(sessionDurationMs()).toBe(2 * 60 * 60 * 1000);
    expect(maxConcurrentSessions()).toBe(3);

    process.env.SESSION_DURATION_HOURS = '-4';
    process.env.MAX_CONCURRENT_SESSIONS = '1.5';
    expect(sessionDurationMs()).toBe(5 * DAY_MS);
    expect(maxConcurrentSessions()).toBe(2);
  });

  it('signs the oldest device out when signing in on a third', async () => {
    fake.live = [{ id: 'laptop' }, { id: 'phone' }];
    const session = await createSession('user-1');

    expect(fake.evicted).toEqual(['laptop']);
    expect(fake.inserted).toHaveLength(1);
    expect(fake.inserted[0]!.userId).toBe('user-1');
    // The cookie and the row expire together, five days out.
    expect(session.expiresAt.getTime() - Date.now()).toBeGreaterThan(5 * DAY_MS - 60_000);
    expect(fake.inserted[0]!.expiresAt).toEqual(session.expiresAt);
  });

  it('evicts nothing on a first or second sign-in', async () => {
    await createSession('user-1');
    expect(fake.evicted).toEqual([]);

    fake.live = [{ id: 'laptop' }];
    await createSession('user-1');
    expect(fake.evicted).toEqual([]);
    expect(fake.inserted).toHaveLength(2);
  });

  it('signs every other device out when the environment allows only one', async () => {
    process.env.MAX_CONCURRENT_SESSIONS = '1';
    fake.live = [{ id: 'laptop' }, { id: 'phone' }];
    await createSession('user-1');
    expect(fake.evicted).toEqual(['laptop', 'phone']);
  });

  it('stores only a hash of the token, never the token itself', async () => {
    const { token } = await createSession('user-1');
    expect(fake.inserted[0]!.id).not.toBe(token);
    expect(fake.inserted[0]!.id).toMatch(/^[0-9a-f]{64}$/);
  });
});
