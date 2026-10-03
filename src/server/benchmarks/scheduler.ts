import cron, { type ScheduledTask } from 'node-cron';
import { runBenchmarksIfDue } from '@/db/benchmarks';

/**
 * The in-process benchmark scheduler, started once per server process from
 * `src/instrumentation.ts`.
 *
 * It does not schedule the admin's cron expression directly. It ticks every
 * minute and asks `runBenchmarksIfDue`, which compares the stored
 * `next_run_at` against now — so an admin's schedule change takes effect on
 * the next tick without restarting anything, several server instances can
 * all tick without double-running (the run takes a database lease), and the
 * external `GET /api/cron/benchmarks` endpoint goes through exactly the same
 * gate. The cost of a tick when nothing is due is one primary-key read.
 *
 * Off on Vercel by default: a serverless function is frozen between requests,
 * so a timer in it fires at random, if at all. There, Vercel Cron calls the
 * endpoint instead (`vercel.json`). `BENCHMARK_SCHEDULER=on|off` overrides
 * either default.
 */

declare global {
  var __mocksathiBenchmarkScheduler: ScheduledTask | undefined;
}

export function schedulerEnabled(): boolean {
  const setting = process.env.BENCHMARK_SCHEDULER?.toLowerCase();
  if (setting === 'off') return false;
  if (setting === 'on') return true;
  return !process.env.VERCEL;
}

export function startBenchmarkScheduler(): void {
  // Kept on `globalThis`: `next dev` can re-run `register` across reloads,
  // and two heartbeats would only ever skip each other at the lease.
  if (globalThis.__mocksathiBenchmarkScheduler || !schedulerEnabled()) return;

  let lastError: string | null = null;

  globalThis.__mocksathiBenchmarkScheduler = cron.schedule(
    '* * * * *',
    async () => {
      try {
        const outcome = await runBenchmarksIfDue('scheduler');
        lastError = null;
        if (outcome.status === 'success') {
          console.log(
            `[benchmarks] ${outcome.mode} run: ${outcome.rowsChanged}/${outcome.rowsScanned} sittings changed, ` +
              `${outcome.testsUpdated} papers updated in ${outcome.durationMs}ms`,
          );
        }
      } catch (error) {
        // Most likely the database is unreachable. Said once, not every minute.
        const message = error instanceof Error ? error.message : String(error);
        if (message !== lastError) console.error('[benchmarks] scheduler tick failed:', message);
        lastError = message;
      }
    },
    { name: 'benchmarks-heartbeat', noOverlap: true },
  );
}
