import { requireAdmin } from '@/auth/cookies';
import { BenchmarkSettingsScreen, type BenchmarkStatus } from '@/components/dashboard/admin/BenchmarkSettingsScreen';
import { benchmarkOverview, getBenchmarkSettings, runInProgress } from '@/db/benchmarks';
import { isValidTimezone } from '@/db/benchmarkSettingsInput';
import { schedulerEnabled } from '@/server/benchmarks/scheduler';

export const dynamic = 'force-dynamic';

/** Admin settings for the best/average computation — see `sdd/benchmarks.md`. */
export default async function BenchmarkSettingsPage() {
  await requireAdmin();
  const [settings, overview] = await Promise.all([getBenchmarkSettings(), benchmarkOverview()]);

  // Formatted here, in the configured zone, so the server and browser render
  // the same text (a client `toLocaleString` would use the viewer's zone).
  const timeZone = isValidTimezone(settings.timezone) ? settings.timezone : 'UTC';
  const format = (value: Date | null) =>
    value
      ? value.toLocaleString('en-IN', { timeZone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', second: '2-digit' })
      : null;

  const status: BenchmarkStatus = {
    running: runInProgress(settings),
    nextRunAt: settings.enabled ? format(settings.nextRunAt) : null,
    computedThrough: format(settings.computedThrough),
    lastFullRebuildAt: format(settings.lastFullRebuildAt),
    rebuildPending: settings.rebuildRequested,
    fullRecomputeEnabled: settings.fullRecomputeEnabled,
    lastRun: settings.lastRunStatus
      ? {
          status: settings.lastRunStatus,
          mode: settings.lastRunMode,
          trigger: settings.lastRunTrigger,
          finishedAt: format(settings.lastRunFinishedAt ?? settings.lastRunStartedAt),
          rowsScanned: settings.lastRunRowsScanned,
          rowsChanged: settings.lastRunRowsChanged,
          testsUpdated: settings.lastRunTestsUpdated,
          durationMs: settings.lastRunDurationMs,
          error: settings.lastRunError,
        }
      : null,
    papersWithFigures: overview.papersWithFigures,
    sittingsCounted: overview.sittingsCounted,
    inProcessScheduler: schedulerEnabled(),
    cronEndpointConfigured: Boolean(process.env.CRON_SECRET),
  };

  return (
    <BenchmarkSettingsScreen
      settings={{
        enabled: settings.enabled,
        schedule: settings.schedule,
        timezone: settings.timezone,
        minCohortSize: settings.minCohortSize,
        excludeEmptyAttempts: settings.excludeEmptyAttempts,
        excludeStaffAttempts: settings.excludeStaffAttempts,
        fullRecomputeEnabled: settings.fullRecomputeEnabled,
        fullRebuildHours: settings.fullRebuildHours,
      }}
      status={status}
    />
  );
}
