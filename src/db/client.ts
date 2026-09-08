import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * The database connection.
 *
 * Kept on `globalThis` in development: `next dev`'s module reloads would
 * otherwise open a fresh `Pool` — and a fresh set of TCP connections to
 * Postgres — on every edit.
 */

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }
  return new Pool({ connectionString });
}

declare global {
  var __mocksathiPgPool: Pool | undefined;
}

const pool = globalThis.__mocksathiPgPool ?? createPool();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__mocksathiPgPool = pool;
}

export const db = drizzle(pool, { schema });
