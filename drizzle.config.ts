import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration.
 *
 * Migrations land in `db/migrations/` (checked in) rather than the tool's
 * usual `drizzle/` default, so the SQL history sits next to the rest of the
 * database setup at `db/` instead of alongside the app source.
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://mocksathi:mocksathi@localhost:5432/mocksathi';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './db/migrations',
  dbCredentials: {
    url: DATABASE_URL,
    /*
     * A hosted database refuses an unencrypted connection; the local Docker one
     * has no certificate to offer. Mirrors `sslFor` in `src/db/client.ts`.
     *
     * Point this at Supabase's *direct* connection (port 5432,
     * `db.<ref>.supabase.co`), not the transaction pooler on 6543 — the pooler
     * does not carry the session state that DDL and advisory locks need, so
     * migrations belong on the direct connection even when the app uses the
     * pooler at runtime.
     */
    ssl: isLocal(DATABASE_URL) ? false : { rejectUnauthorized: false },
  },
});

function isLocal(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === 'db';
  } catch {
    return true;
  }
}
