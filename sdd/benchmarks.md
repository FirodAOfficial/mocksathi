# Best & average benchmarks

Every result page compares the candidate with the paper's **best** sitting and its **average**
("How You Compare" and the per-question time chart). Until this change both were hardcoded
(`REFERENCE_TOPPER` / `REFERENCE_AVERAGE` in `src/exam/result.ts`), baked into each stored
`test_attempts.result` at submit time, and identical for every paper. Now they are computed from
real sittings by a scheduled job, configurable at `/dashboard/admin/benchmarks`.

## Where things live

| Piece | File |
|---|---|
| Pure maths: contributions, sums, best, overlay onto a result | `src/exam/benchmark.ts` (+ `.test.ts`) |
| Run engine, settings, read-side view | `src/db/benchmarks.ts` |
| Settings validation, cron next-run (`node-cron`) | `src/db/benchmarkSettingsInput.ts` (+ `.test.ts`) |
| In-process scheduler (`node-cron`, one-minute heartbeat) | `src/server/benchmarks/scheduler.ts`, started by `src/instrumentation.ts` |
| External trigger for Vercel Cron | `GET /api/cron/benchmarks` + `vercel.json` |
| Admin: save settings / run now | `PUT /api/admin/benchmarks`, `POST /api/admin/benchmarks/run` |
| Admin page | `src/app/dashboard/admin/benchmarks/page.tsx`, `BenchmarkSettingsScreen` |
| Tables | `test_benchmarks`, `benchmark_settings`, `test_attempts.benchmark_contribution` (migration `0019`) |
| UI | `BenchmarkComparison` (replaces `TopperComparison`), `TimeAnalysis` (rewritten) |

## Definitions

- **Cohort** — each candidate's *latest* sitting of the paper (one `test_attempts` row per
  `(user, test)`), optionally excluding sittings with no answered question and admin/support
  accounts (both on by default).
- **Average** — mean of the cohort's score, accuracy, correct/wrong/unattempted and total time.
  Per-question average time counts only candidates who spent time on that question.
- **Best** — highest score; ties go to higher accuracy, then less time. Its per-question times are
  that sitting's own.
- **Minimum cohort** — below `min_cohort_size` (default 3) the comparison is withheld and the page
  says how many candidates it is waiting for. Applied on read, so changing it needs no recompute.

## Incremental computation

`test_benchmarks.aggregate` holds running *sums*, and each attempt row remembers exactly what it
last added (`benchmark_contribution`). An incremental run reads only rows with
`updated_at > computed_through − 10 min` (indexed) and applies `new − old` per row:

- new sitting → adds; resit → swaps old figures for new; row now excluded → subtracts.
- Re-reading an unchanged row is a no-op, which is what makes the 10-minute overlap safe. It covers
  a submission whose transaction started before the last cutoff but committed after it.
- `recordAttempt` now stamps `updated_at` with the database's `now()`, so app-server clock skew
  can't hide a row. `scripts/remarkAttempts.ts` already bumps `updated_at`, so re-marks flow in too.
- Best is folded in from the changed rows. Only when the current best's own row got worse is it
  re-found, with one indexed query for that paper (`test_attempts_test_id_idx`), not a rescan.

A **full** recompute (same code path, fresh sums) runs on the first run, every
`full_rebuild_hours` (default 24, 0 = only on request), whenever an eligibility rule changes, or on
the admin's "Recompute from scratch". It corrects what incremental can't see: sittings deleted with
an account, and float drift in the sums. Each run is a single transaction, so readers see the old
figures or the new ones, never half a run.

**Full recompute can be switched off** (`full_recompute_enabled`, "Full recompute" section on the
admin page; migration `0020`). Off, nothing ever resets the sums: the timer is ignored, the "Recompute
from scratch" button is disabled, and the API refuses a forced full run (`full-recompute-disabled`).
The two cases that otherwise *force* a full run — the very first run, and a change to who counts —
run a **recheck** instead: the incremental `new − old` pass over every sitting rather than the recent
window. That is exact for both; what it can't do is remove contributions of sittings deleted along with
an account (they stay counted until full recompute is turned back on and run). Run modes are therefore
`incremental`, `recheck` and `full`.

`src/exam/benchmark.test.ts` has a randomized test asserting incremental == from-scratch across 40
batches of submissions, resits and eligibility flips. The engine was also run end to end against a
real Postgres (PGlite, all migrations applied): first full run, new sitting + resit, best holder
resitting lower, full-vs-incremental equality, deleted account, rebuild on rule change, lease and
due checks.

## Scheduling

The admin sets a 5-field cron expression and time zone. `next_run_at` is computed with `node-cron`
(`createTask(...).getNextRuns(1)`, a stopped task, so no timer) after every save and run. Anything
that wants to run calls `runBenchmarksIfDue`, which compares `next_run_at` with now:

- **In-app scheduler** — `node-cron` ticks every minute in the Node server process. On by default,
  off when `VERCEL` is set (a sleeping function's timer fires unpredictably). `BENCHMARK_SCHEDULER=on|off` overrides.
- **Vercel Cron** — `vercel.json` calls `/api/cron/benchmarks` with `Authorization: Bearer
  $CRON_SECRET`. The checked-in schedule is daily (`30 20 * * *` UTC = 02:00 IST) because the
  Hobby plan rejects anything more frequent. On Pro, raise it (e.g. `*/15 * * * *`), since the
  admin's schedule can only fire as often as something calls the endpoint.
- **Admin "Run now" / "Recompute from scratch"** — runs immediately, even with the schedule off.

Overlap is prevented by a lease (`benchmark_settings.running_since`, taken with a conditional
`UPDATE`). It is not an advisory lock, because the app connects through Supabase's transaction
pooler, which can't hold session locks. A lease older than 15 minutes is presumed dead and taken over.

## Read side

`withBenchmark(result, view)` overlays the current figures on any `ExamResult`, both on the submit
response and on "View Submission". The comparison stored inside an old result is therefore ignored,
and a candidate's page improves as the cohort grows. A fresh submission is compared against the
last run's figures and joins them on the next run.

## Not done

- Existing tables have no RLS. The two new ones enable it with no policies; the app connects as the
  table owner, so it is unaffected while Supabase's REST API is shut out. The older tables should
  get the same treatment.
- The dashboard's subject breakdown (`SubjectSnapshotList`) still has no cohort benchmark marker.
  `test_benchmarks` now has the data to add one.
