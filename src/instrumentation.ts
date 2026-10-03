/**
 * Runs once when a Next.js server starts (`instrumentation.ts`, see
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`).
 *
 * Starts the benchmark scheduler (`src/server/benchmarks/scheduler.ts`). Node
 * only — it needs `pg` and timers — so it is imported conditionally, never on
 * the edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBenchmarkScheduler } = await import('./server/benchmarks/scheduler');
    startBenchmarkScheduler();
  }
}
