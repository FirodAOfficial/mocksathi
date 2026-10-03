import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { runBenchmarks, type BenchmarkMode } from '@/db/benchmarks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** A full recompute reads every sitting; give it longer than a page render. */
export const maxDuration = 300;

/**
 * Runs the benchmark computation now — "Run now" (`incremental`) and
 * "Recompute from scratch" (`full`) on the settings page. Admin-only.
 *
 * Runs even when the schedule is switched off: that switch stops the timer,
 * not an admin's explicit request. Still skipped if a run is already going,
 * and a `full` run is refused while full recompute is switched off.
 */
export async function POST(request: Request): Promise<NextResponse> {
  await requireAdmin();

  const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
  const mode: BenchmarkMode = body?.mode === 'full' ? 'full' : 'incremental';

  const outcome = await runBenchmarks({ trigger: 'admin', mode });
  const status = outcome.status === 'failed' ? 500 : outcome.status === 'skipped' ? 409 : 200;
  return NextResponse.json(outcome, { status, headers: { 'cache-control': 'no-store' } });
}
