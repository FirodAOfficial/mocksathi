import 'server-only';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * The database connection.
 *
 * Resolved lazily, on first use. `next build` imports every route module to
 * collect its config, and a build never talks to Postgres — connecting at
 * import time would fail the build wherever `DATABASE_URL` isn't in the
 * environment.
 *
 * Kept on `globalThis`: `next dev`'s module reloads would otherwise open a
 * fresh `Pool` — and a fresh set of TCP connections to Postgres — on every
 * edit.
 */

type Db = NodePgDatabase<typeof schema>;

declare global {
  var __mocksathiDb: Db | undefined;
}

function getDb(): Db {
  if (!globalThis.__mocksathiDb) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
    }
    globalThis.__mocksathiDb = drizzle(new Pool({ connectionString, ssl: sslFor(connectionString) }), {
      schema,
    });
  }
  return globalThis.__mocksathiDb;
}

/**
 * TLS settings for a connection string.
 *
 * A hosted Postgres — Supabase, Neon, RDS — refuses an unencrypted connection,
 * and `node-postgres` does not turn TLS on by default. The local Docker
 * database in `docker-compose.yml` has no certificate, so asking for TLS there
 * would break the setup that works today; the host decides.
 *
 * `rejectUnauthorized: false` encrypts the connection but does not verify the
 * server's certificate, which is what Supabase's own Node guidance uses because
 * their pooler presents a chain Node does not ship a root for. It stops
 * passive eavesdropping, not an active man-in-the-middle. To harden it, put
 * Supabase's CA certificate on disk and pass `ssl: { ca }` here instead.
 */
export function sslFor(connectionString: string): { rejectUnauthorized: boolean } | false {
  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    // Not a URL we can read — leave TLS off and let the driver report the
    // connection failure itself, rather than guessing.
    return false;
  }

  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === 'db';
  return isLocal ? false : { rejectUnauthorized: false };
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop) as unknown;
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
