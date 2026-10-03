import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runBenchmarksIfDue } from '@/db/benchmarks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The external trigger for the benchmark run, for hosts where the in-process
 * scheduler can't live (`src/server/benchmarks/scheduler.ts`) — Vercel Cron
 * calls it per `vercel.json`, sending `Authorization: Bearer $CRON_SECRET`.
 *
 * Public in the sense that it has no session, so it is on the public-routes
 * list in `.claude/skills/auth-security-review/SKILL.md`: the shared secret is
 * the gate, compared in constant time, and without `CRON_SECRET` configured
 * the route does not exist at all. It never runs anything the schedule hasn't
 * made due, so even a leaked secret only lets a caller ask "is it time yet?".
 * Its answer is the run's counts — nothing about any candidate.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });

  const outcome = await runBenchmarksIfDue('cron-endpoint');
  return NextResponse.json(outcome, {
    status: outcome.status === 'failed' ? 500 : 200,
    headers: { 'cache-control': 'no-store' },
  });
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const presented = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}
