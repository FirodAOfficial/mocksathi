import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { updateBenchmarkSettings } from '@/db/benchmarks';
import { parseBenchmarkSettingsInput, type BenchmarkSettingsInput } from '@/db/benchmarkSettingsInput';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Saves the benchmark settings. Admin-only — `requireAdmin()` 404s anyone else, independently of the page. */
export async function PUT(request: Request): Promise<NextResponse> {
  const admin = await requireAdmin();

  let body: BenchmarkSettingsInput;
  try {
    body = (await request.json()) as BenchmarkSettingsInput;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const parsed = parseBenchmarkSettingsInput(body);
  if (!parsed.ok) return NextResponse.json({ code: parsed.code, detail: parsed.detail }, { status: 400 });

  const settings = await updateBenchmarkSettings(parsed.fields, admin.id);
  return NextResponse.json(
    { nextRunAt: settings.nextRunAt, rebuildRequested: settings.rebuildRequested },
    { headers: { 'cache-control': 'no-store' } },
  );
}
