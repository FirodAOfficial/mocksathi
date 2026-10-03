import 'server-only';
import { and, eq, inArray, isNull, lt, notInArray, or, sql } from 'drizzle-orm';
import { cache } from 'react';
import {
  applyContribution,
  contributionFor,
  emptyAggregate,
  foldBest,
  isBetter,
  sameContribution,
  type AttemptForBenchmark,
  type BenchmarkAggregate,
  type BenchmarkBest,
  type BenchmarkContribution,
  type BenchmarkView,
  type Eligibility,
} from '@/exam/benchmark';
import { nextRunFor, type ParsedBenchmarkSettings } from './benchmarkSettingsInput';
import { db } from './client';
import { benchmarkSettings, testBenchmarks, type BenchmarkSettingsRow } from './schema';

/**
 * Computing and reading each paper's best-and-average figures — see
 * `sdd/benchmarks.md` for the design, `src/exam/benchmark.ts` for the maths.
 *
 * Three modes, one code path:
 *
 * - **incremental** reads only the sittings whose `updated_at` moved since the
 *   last run's `computed_through` (minus an overlap window), and applies each
 *   one's `new - old` contribution to its paper's running sums. Cost scales
 *   with how many sittings changed, not with how many exist.
 * - **full** re-reads every sitting and rebuilds every paper's sums from
 *   scratch. It runs on a timer (`full_rebuild_hours`), when an eligibility
 *   rule changes, or when an admin asks — and it is what corrects the two
 *   things incremental can't see: an account deleted (its sittings vanish
 *   without ever being "updated"), and floating-point drift in the sums.
 *   An admin can switch it off entirely (`full_recompute_enabled`).
 * - **recheck** is incremental over *every* sitting rather than the recent
 *   ones: each row's contribution is re-derived and its `new - old` applied,
 *   with no reset. It stands in for a full run wherever one would be forced
 *   (first run, an eligibility rule changed) while full recompute is off —
 *   exact for both, but it can't see deleted sittings either.
 *
 * Every write of a run happens in one transaction, so a reader sees the old
 * figures or the new ones, never half a run; and a run that dies leaves the
 * sums and the per-row contributions agreeing with each other.
 */

/** A run holding the lease longer than this is presumed dead, and the next one may take over. */
const LEASE_MINUTES = 15;

/** Whether a run is going right now — the lease is held and not yet expired. */
export function runInProgress(settings: Pick<BenchmarkSettingsRow, 'runningSince'>): boolean {
  return settings.runningSince !== null && Date.now() - settings.runningSince.getTime() < LEASE_MINUTES * 60_000;
}
/**
 * How far back past `computed_through` an incremental run re-reads. A
 * submission's `updated_at` is its transaction's start time, so one that
 * started before the last run's cutoff but committed after it would
 * otherwise never be seen. Re-reading is free of double counting — a row
 * whose contribution hasn't changed is skipped.
 */
const OVERLAP_MINUTES = 10;
const PAGE_SIZE = 1000;

export type BenchmarkTrigger = 'scheduler' | 'cron-endpoint' | 'admin';
export type BenchmarkMode = 'incremental' | 'recheck' | 'full';

export interface BenchmarkRunOutcome {
  status: 'success' | 'failed' | 'skipped';
  /** Why a run was skipped. */
  reason?: 'disabled' | 'not-due' | 'busy' | 'full-recompute-disabled';
  mode?: BenchmarkMode;
  rowsScanned?: number;
  rowsChanged?: number;
  testsUpdated?: number;
  durationMs?: number;
  error?: string;
}

/* -------------------------------------------------------------------------
 * Settings
 * ---------------------------------------------------------------------- */

/** The settings row, created with its defaults if a database somehow lacks it (the migration inserts it). */
export async function getBenchmarkSettings(): Promise<BenchmarkSettingsRow> {
  const [row] = await db.select().from(benchmarkSettings).where(eq(benchmarkSettings.id, 1)).limit(1);
  if (row) return row;

  await db.insert(benchmarkSettings).values({ id: 1 }).onConflictDoNothing();
  const [created] = await db.select().from(benchmarkSettings).where(eq(benchmarkSettings.id, 1)).limit(1);
  return created!;
}

/** Per-request copy for pages that read the settings more than once (the result page's view lookup). */
const settingsForRequest = cache(getBenchmarkSettings);

/**
 * Saves the admin's settings.
 *
 * Changing who counts (`exclude*`) makes every stored contribution wrong at
 * once, so it flags a full rebuild for the next run rather than trying to
 * patch the sums. The minimum cohort size needs nothing — it is applied when
 * the figures are read, not when they are computed.
 */
export async function updateBenchmarkSettings(
  fields: ParsedBenchmarkSettings,
  adminId: string,
): Promise<BenchmarkSettingsRow> {
  const current = await getBenchmarkSettings();
  const eligibilityChanged =
    current.excludeEmptyAttempts !== fields.excludeEmptyAttempts ||
    current.excludeStaffAttempts !== fields.excludeStaffAttempts;

  const [row] = await db
    .update(benchmarkSettings)
    .set({
      ...fields,
      nextRunAt: nextRunFor(fields.schedule, fields.timezone),
      rebuildRequested: eligibilityChanged ? true : current.rebuildRequested,
      updatedAt: new Date(),
      updatedBy: adminId,
    })
    .where(eq(benchmarkSettings.id, 1))
    .returning();
  return row!;
}

/* -------------------------------------------------------------------------
 * Reading
 * ---------------------------------------------------------------------- */

/** One paper's figures, for `withBenchmark`. An unsat (or not yet computed) paper gets an empty aggregate, not null. */
export async function benchmarkViewForTest(testId: string): Promise<BenchmarkView> {
  const [rows, settings] = await Promise.all([
    db.select().from(testBenchmarks).where(eq(testBenchmarks.testId, testId)).limit(1),
    settingsForRequest(),
  ]);
  const row = rows[0];
  return {
    aggregate: row ? (row.aggregate as BenchmarkAggregate) : emptyAggregate(),
    best: (row?.best as BenchmarkBest | null | undefined) ?? null,
    computedAt: row?.computedAt ?? null,
    minCohortSize: settings.minCohortSize,
  };
}

export interface BenchmarkOverview {
  papersWithFigures: number;
  sittingsCounted: number;
}

/** Headline counts for the admin settings page. */
export async function benchmarkOverview(): Promise<BenchmarkOverview> {
  const [row] = await db
    .select({
      papers: sql<number>`count(*)::int`,
      sittings: sql<number>`coalesce(sum(${testBenchmarks.cohortSize}), 0)::int`,
    })
    .from(testBenchmarks);
  return { papersWithFigures: row?.papers ?? 0, sittingsCounted: row?.sittings ?? 0 };
}

/* -------------------------------------------------------------------------
 * Running
 * ---------------------------------------------------------------------- */

/**
 * Runs when the schedule says so — what both the in-process scheduler and the
 * external cron endpoint call, every time they tick. Cheap when nothing is
 * due: one primary-key read.
 */
export async function runBenchmarksIfDue(trigger: BenchmarkTrigger): Promise<BenchmarkRunOutcome> {
  const settings = await getBenchmarkSettings();
  if (!settings.enabled) return { status: 'skipped', reason: 'disabled' };
  if (settings.nextRunAt && settings.nextRunAt.getTime() > Date.now()) return { status: 'skipped', reason: 'not-due' };
  return runBenchmarks({ trigger });
}

function decideMode(settings: BenchmarkSettingsRow): BenchmarkMode {
  if (settings.rebuildRequested || !settings.computedThrough) {
    return settings.fullRecomputeEnabled ? 'full' : 'recheck';
  }
  if (settings.fullRecomputeEnabled && settings.fullRebuildHours > 0) {
    const last = settings.lastFullRebuildAt?.getTime() ?? 0;
    if (Date.now() - last >= settings.fullRebuildHours * 3_600_000) return 'full';
  }
  return 'incremental';
}

/**
 * One run, now. `mode` forces one; omitted, the settings decide. Skipped (not
 * queued) when another run holds the lease — on another server instance, say,
 * or an admin's "Run now" landing mid-schedule — and a forced `full` is
 * refused while full recompute is switched off.
 */
export async function runBenchmarks({
  trigger,
  mode: requestedMode,
}: {
  trigger: BenchmarkTrigger;
  mode?: BenchmarkMode;
}): Promise<BenchmarkRunOutcome> {
  const [leased] = await db
    .update(benchmarkSettings)
    .set({ runningSince: sql`now()`, lastRunStartedAt: sql`now()` })
    .where(
      and(
        eq(benchmarkSettings.id, 1),
        or(
          isNull(benchmarkSettings.runningSince),
          lt(benchmarkSettings.runningSince, sql`now() - make_interval(mins => ${LEASE_MINUTES})`),
        ),
      ),
    )
    .returning();
  if (!leased) return { status: 'skipped', reason: 'busy' };

  if (requestedMode === 'full' && !leased.fullRecomputeEnabled) {
    await db.update(benchmarkSettings).set({ runningSince: null }).where(eq(benchmarkSettings.id, 1));
    return { status: 'skipped', reason: 'full-recompute-disabled' };
  }

  const started = Date.now();
  // A forced incremental with nothing yet computed, or with the rules changed
  // since, would miss rows outside its window; it reads every sitting instead.
  const mode: BenchmarkMode =
    requestedMode === 'incremental' && (!leased.computedThrough || leased.rebuildRequested)
      ? decideMode(leased)
      : (requestedMode ?? decideMode(leased));
  const eligibility: Eligibility = {
    excludeEmpty: leased.excludeEmptyAttempts,
    excludeStaff: leased.excludeStaffAttempts,
  };

  try {
    const stats = await computeRun(mode, eligibility, leased.computedThrough);
    const durationMs = Date.now() - started;

    await finishRun(leased, {
      lastRunStatus: 'success',
      lastRunMode: mode,
      lastRunTrigger: trigger,
      lastRunRowsScanned: stats.rowsScanned,
      lastRunRowsChanged: stats.rowsChanged,
      lastRunTestsUpdated: stats.testsUpdated,
      lastRunDurationMs: durationMs,
      lastRunError: null,
      computedThrough: stats.cutoff,
      ...(mode === 'full' ? { lastFullRebuildAt: stats.cutoff } : {}),
      // Both read every sitting under the current rules, so either settles a
      // pending rules change.
      ...(mode !== 'incremental'
        ? {
            // Cleared only if nobody changed the rules while this ran — a
            // change made mid-run was not applied to it.
            // (Within a millisecond, not `=`: `leased.updatedAt` is a JS Date,
            // the column holds microseconds.)
            rebuildRequested: sql`case when abs(extract(epoch from ${benchmarkSettings.updatedAt} - ${leased.updatedAt.toISOString()}::timestamptz)) < 0.001 then false else ${benchmarkSettings.rebuildRequested} end`,
          }
        : {}),
    });

    return { status: 'success', mode, ...stats, durationMs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[benchmarks] run failed', error);
    await finishRun(leased, {
      lastRunStatus: 'failed',
      lastRunMode: mode,
      lastRunTrigger: trigger,
      lastRunDurationMs: Date.now() - started,
      lastRunError: message.slice(0, 500),
    });
    return { status: 'failed', mode, error: message };
  }
}

/** Releases the lease and books the next run — from the schedule as it is *now*, in case it was edited mid-run. */
type SettingsUpdate = Parameters<ReturnType<typeof db.update<typeof benchmarkSettings>>['set']>[0];

async function finishRun(leased: BenchmarkSettingsRow, fields: SettingsUpdate) {
  const [current] = await db
    .select({ schedule: benchmarkSettings.schedule, timezone: benchmarkSettings.timezone })
    .from(benchmarkSettings)
    .where(eq(benchmarkSettings.id, 1));
  const schedule = current ?? { schedule: leased.schedule, timezone: leased.timezone };

  await db
    .update(benchmarkSettings)
    .set({
      ...fields,
      runningSince: null,
      lastRunFinishedAt: sql`now()`,
      nextRunAt: nextRunFor(schedule.schedule, schedule.timezone),
    })
    .where(eq(benchmarkSettings.id, 1));
}

interface RunStats {
  cutoff: Date;
  rowsScanned: number;
  rowsChanged: number;
  testsUpdated: number;
}

interface PaperState {
  aggregate: BenchmarkAggregate;
  best: BenchmarkBest | null;
  changes: { attemptId: string; next: BenchmarkContribution | null }[];
  dirty: boolean;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function computeRun(
  mode: BenchmarkMode,
  eligibility: Eligibility,
  computedThrough: Date | null,
): Promise<RunStats> {
  return db.transaction(async (tx) => {
    const cutoffRows = await tx.execute<{ cutoff: Date | string }>(sql`select now() as cutoff`);
    const cutoff = new Date(cutoffRows.rows[0]!.cutoff);
    const since =
      mode === 'incremental' && computedThrough
        ? new Date(computedThrough.getTime() - OVERLAP_MINUTES * 60_000)
        : null;

    // `since` null reads every sitting: a full run, or a recheck.
    const papers = new Map<string, PaperState>();
    let rowsScanned = 0;
    let rowsChanged = 0;
    let afterId: string | null = null;

    for (;;) {
      const page = await readAttempts(tx, since, afterId);
      if (page.length === 0) break;
      rowsScanned += page.length;
      afterId = page[page.length - 1]!.id;

      if (mode !== 'full') await loadPapers(tx, papers, page);

      const writes: { id: string; contribution: BenchmarkContribution | null }[] = [];
      for (const attempt of page) {
        const next = contributionFor(attempt, eligibility);
        const paper = paperFor(papers, attempt.testId);

        if (mode === 'full') {
          // Fresh sums: count `next` against nothing.
          applyContribution(paper.aggregate, null, next);
          if (next && (!paper.best || isBetter(next, paper.best))) paper.best = { ...next, attemptId: attempt.id };
          paper.dirty = true;
        } else if (!sameContribution(attempt.contribution, next)) {
          applyContribution(paper.aggregate, attempt.contribution, next);
          paper.changes.push({ attemptId: attempt.id, next });
          paper.dirty = true;
        }

        if (!sameContribution(attempt.contribution, next)) writes.push({ id: attempt.id, contribution: next });
      }

      rowsChanged += writes.length;
      await writeContributions(tx, writes);
      if (page.length < PAGE_SIZE) break;
    }

    // Best, for incremental runs and rechecks — after the contributions are
    // written, so a stale best can be re-found from them.
    if (mode !== 'full') {
      for (const [testId, paper] of papers) {
        if (paper.changes.length === 0) continue;
        const { best, stale } = foldBest(paper.best, paper.changes);
        paper.best = stale ? await bestFromContributions(tx, testId) : best;
      }
    }

    const dirty = [...papers].filter(([, paper]) => paper.dirty);
    if (dirty.length > 0) {
      await tx
        .insert(testBenchmarks)
        .values(
          dirty.map(([testId, paper]) => ({
            testId,
            cohortSize: paper.aggregate.cohortSize,
            aggregate: tidy(paper.aggregate),
            best: paper.best,
            computedAt: cutoff,
          })),
        )
        .onConflictDoUpdate({
          target: testBenchmarks.testId,
          set: {
            cohortSize: sql`excluded.cohort_size`,
            aggregate: sql`excluded.aggregate`,
            best: sql`excluded.best`,
            computedAt: sql`excluded.computed_at`,
          },
        });
    }

    // A full run is the whole truth: a paper nobody counts any more (its
    // sittings deleted, or all excluded) loses its row.
    if (mode === 'full') {
      const kept = dirty.map(([testId]) => testId);
      await tx.delete(testBenchmarks).where(kept.length > 0 ? notInArray(testBenchmarks.testId, kept) : undefined);
    }

    return { cutoff, rowsScanned, rowsChanged, testsUpdated: dirty.length };
  });
}

function paperFor(papers: Map<string, PaperState>, testId: string): PaperState {
  let paper = papers.get(testId);
  if (!paper) {
    paper = { aggregate: emptyAggregate(), best: null, changes: [], dirty: false };
    papers.set(testId, paper);
  }
  return paper;
}

/** Loads the stored sums for any paper in `page` not already held — one query per page, not per row. */
async function loadPapers(tx: Tx, papers: Map<string, PaperState>, page: AttemptForBenchmark[]) {
  const missing = [...new Set(page.map((attempt) => attempt.testId))].filter((testId) => !papers.has(testId));
  if (missing.length === 0) return;

  const rows = await tx.select().from(testBenchmarks).where(inArray(testBenchmarks.testId, missing));
  const byTest = new Map(rows.map((row) => [row.testId, row]));
  for (const testId of missing) {
    const row = byTest.get(testId);
    papers.set(testId, {
      aggregate: row ? structuredClone(row.aggregate as BenchmarkAggregate) : emptyAggregate(),
      best: (row?.best as BenchmarkBest | null | undefined) ?? null,
      changes: [],
      dirty: false,
    });
  }
}

/**
 * One page of sittings, keyset-paged by id. Only the columns the maths needs
 * — `result.questions` carries every criterion's feedback, so the per-question
 * times are pulled out in SQL rather than shipping the whole array over.
 */
async function readAttempts(tx: Tx, since: Date | null, afterId: string | null): Promise<AttemptForBenchmark[]> {
  const result = await tx.execute<{
    id: string;
    test_id: string;
    role: string;
    you: AttemptForBenchmark['you'] | null;
    times: Record<string, number> | null;
    contribution: BenchmarkContribution | null;
  }>(sql`
    select
      a.id,
      a.test_id,
      u.role::text as role,
      a.result -> 'you' as you,
      (
        select jsonb_object_agg(q ->> 'number', q -> 'yourTimeSeconds')
        from jsonb_array_elements(
          case when jsonb_typeof(a.result -> 'questions') = 'array' then a.result -> 'questions' else '[]'::jsonb end
        ) as q
        where q ? 'number'
      ) as times,
      a.benchmark_contribution as contribution
    from test_attempts a
    join users u on u.id = a.user_id
    where true
      ${since ? sql`and a.updated_at > ${since.toISOString()}::timestamptz` : sql``}
      ${afterId ? sql`and a.id > ${afterId}::uuid` : sql``}
    order by a.id
    limit ${PAGE_SIZE}
  `);

  return result.rows
    .filter((row) => row.you !== null)
    .map((row) => ({
      id: row.id,
      testId: row.test_id,
      role: row.role,
      you: row.you!,
      times: row.times,
      contribution: row.contribution,
    }));
}

/** Records what each row now contributes — never touching `updated_at`, or every run would re-read its own writes. */
async function writeContributions(tx: Tx, writes: { id: string; contribution: BenchmarkContribution | null }[]) {
  if (writes.length === 0) return;
  const values = sql.join(
    writes.map(
      (write) =>
        sql`(${write.id}::uuid, ${write.contribution ? JSON.stringify(write.contribution) : null}::jsonb)`,
    ),
    sql`, `,
  );
  await tx.execute(sql`
    update test_attempts as t
    set benchmark_contribution = v.contribution
    from (values ${values}) as v(id, contribution)
    where t.id = v.id
  `);
}

/** The best counted sitting of one paper — the fallback when its previous holder resat lower. */
async function bestFromContributions(tx: Tx, testId: string): Promise<BenchmarkBest | null> {
  const result = await tx.execute<{ id: string; contribution: BenchmarkContribution }>(sql`
    select id, benchmark_contribution as contribution
    from test_attempts
    where test_id = ${testId}::uuid and benchmark_contribution is not null
    order by
      (benchmark_contribution ->> 'score')::float8 desc,
      (benchmark_contribution ->> 'accuracy')::float8 desc,
      (benchmark_contribution ->> 'timeSeconds')::float8 asc
    limit 1
  `);
  const row = result.rows[0];
  return row ? { ...row.contribution, attemptId: row.id } : null;
}

/** Rounds away the float noise that adding and subtracting leaves in the sums (`0.1 + 0.2 - 0.2`). */
function tidy(aggregate: BenchmarkAggregate): BenchmarkAggregate {
  const r = (value: number) => Math.round(value * 1e6) / 1e6;
  const questionTimes: BenchmarkAggregate['questionTimes'] = {};
  for (const [number, slot] of Object.entries(aggregate.questionTimes)) {
    questionTimes[number] = { sum: r(slot.sum), count: slot.count };
  }
  return {
    cohortSize: aggregate.cohortSize,
    score: r(aggregate.score),
    accuracy: r(aggregate.accuracy),
    correct: r(aggregate.correct),
    wrong: r(aggregate.wrong),
    unattempted: r(aggregate.unattempted),
    timeSeconds: r(aggregate.timeSeconds),
    questionTimes,
  };
}
