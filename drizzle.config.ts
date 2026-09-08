import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration.
 *
 * Migrations land in `db/migrations/` (checked in) rather than the tool's
 * usual `drizzle/` default, so the SQL history sits next to the rest of the
 * database setup at `db/` instead of alongside the app source.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://mocksathi:mocksathi@localhost:5432/mocksathi',
  },
});
