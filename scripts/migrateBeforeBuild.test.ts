import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The build-time migration gate.
 *
 * Migration 0008 shipped without being applied and took production down: the
 * code selected a column that did not exist, so every authenticated request
 * failed. These tests hold the two halves of the fix in place — that the build
 * runs migrations at all, and that it only does so where a migration database
 * is configured, so a preview deploy can never migrate production.
 */

const SCRIPT = 'scripts/migrateBeforeBuild.mjs';

function run(env: Record<string, string | undefined>): string {
  return execFileSync('node', [SCRIPT], {
    encoding: 'utf8',
    // A near-empty environment, so an inherited MIGRATION_DATABASE_URL from a
    // developer's shell cannot make the skip case connect to something.
    // `NODE_ENV` is carried because the repo's `ProcessEnv` requires it.
    env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test', ...env },
  });
}

describe('migrateBeforeBuild', () => {
  it('skips, successfully, when no migration database is configured', () => {
    // The local and preview case. A build here must not need Postgres.
    const output = run({ MIGRATION_DATABASE_URL: undefined });

    expect(output).toContain('skipping migrations');
  });

  it('names the host it is about to migrate, and never the credentials', () => {
    // Build logs are readable by anyone with project access, and the
    // connection string carries a password.
    let output = '';
    try {
      output = run({ MIGRATION_DATABASE_URL: 'postgres://someone:hunter2@db.example.com:5432/app' });
    } catch (error) {
      // drizzle-kit will fail to reach example.com; its output is what we get.
      output = String((error as { stdout?: string }).stdout ?? '');
    }

    expect(output).toContain('db.example.com:5432');
    expect(output).not.toContain('hunter2');
    expect(output).not.toContain('someone');
  });

  it('is wired into the build command', () => {
    // Without this line the script is dead code and the outage can recur.
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

    expect(pkg.scripts.build).toContain(SCRIPT);
    expect(pkg.scripts.build).toContain('next build');
    // `&&`, not `;` — a failed migration must stop the build.
    expect(pkg.scripts.build).toMatch(/&&\s*next build/);
  });

  it('gates on MIGRATION_DATABASE_URL, not DATABASE_URL', () => {
    // Vercel hands previews the production DATABASE_URL by default, so keying
    // off that would let a preview branch migrate production.
    const source = readFileSync(SCRIPT, 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '');

    expect(code).toContain('process.env.MIGRATION_DATABASE_URL');
    expect(code).not.toContain('process.env.DATABASE_URL');
  });
});
