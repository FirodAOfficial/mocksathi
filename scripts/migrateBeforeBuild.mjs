#!/usr/bin/env node
/**
 * Applies pending migrations before `next build`, but only where a migration
 * database is configured.
 *
 * This exists because of an outage. Migration 0008 added `users.email_verified_at`,
 * the code that selects it was deployed, and the migration was not run — so
 * every authenticated request on production failed at once, since
 * `getUserBySessionToken` selects the whole `users` row. The deploy order was
 * the only thing holding the two together, and it was wrong once.
 *
 * The gate is `MIGRATION_DATABASE_URL`, not `DATABASE_URL`, and that choice is
 * the whole safety story:
 *
 * - Set it in Vercel's **Production** environment only. Production deploys then
 *   migrate before the build that needs the new schema.
 * - Preview and development deploys leave it unset, so they skip. A preview
 *   branch cannot migrate the production database, which it would if this keyed
 *   off `DATABASE_URL` — Vercel gives previews the production value by default.
 * - Locally it is unset too, so `npm run build` stays a pure build and does not
 *   need Postgres running.
 *
 * When it *is* set, a migration failure fails the build. That is the point:
 * shipping code whose schema did not land is the failure this prevents, so a
 * half-applied deploy must not become a green one.
 */
import { spawnSync } from 'node:child_process';

const url = process.env.MIGRATION_DATABASE_URL;

if (!url) {
  console.log(
    '[build] MIGRATION_DATABASE_URL is not set — skipping migrations. ' +
      "Set it in Vercel's Production environment so production deploys migrate first.",
  );
  process.exit(0);
}

// Host only. The string carries a password, and build logs are readable by
// anyone with project access.
let target = 'the configured database';
try {
  target = new URL(url).host;
} catch {
  // Not a parseable URL — say so rather than echoing the raw value.
  target = 'an unparseable MIGRATION_DATABASE_URL';
}

console.log(`[build] applying migrations to ${target}`);

const result = spawnSync('npx', ['drizzle-kit', 'migrate'], {
  stdio: 'inherit',
  // `npx.cmd` on Windows; the repo is developed on both.
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  console.error(
    '[build] migrations failed — stopping the build so code is not deployed ahead of its schema.',
  );
  process.exit(result.status ?? 1);
}

console.log('[build] migrations applied');
