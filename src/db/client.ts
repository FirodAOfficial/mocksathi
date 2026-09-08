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
    globalThis.__mocksathiDb = drizzle(new Pool({ connectionString }), { schema });
  }
  return globalThis.__mocksathiDb;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop) as unknown;
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
