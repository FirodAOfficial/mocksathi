import cron from 'node-cron';

/** What `PUT /api/admin/benchmarks` accepts — the fields `BenchmarkSettingsForm` edits. */
export interface BenchmarkSettingsInput {
  enabled?: boolean;
  schedule?: string;
  timezone?: string;
  minCohortSize?: string | number;
  excludeEmptyAttempts?: boolean;
  excludeStaffAttempts?: boolean;
  fullRecomputeEnabled?: boolean;
  fullRebuildHours?: string | number;
}

export interface ParsedBenchmarkSettings {
  enabled: boolean;
  schedule: string;
  timezone: string;
  minCohortSize: number;
  excludeEmptyAttempts: boolean;
  excludeStaffAttempts: boolean;
  fullRecomputeEnabled: boolean;
  fullRebuildHours: number;
}

export type ParseBenchmarkSettingsResult =
  | { ok: true; fields: ParsedBenchmarkSettings }
  | { ok: false; code: string; detail: string };

/** The schedules the settings page offers as one click — anything else is "Custom". */
export const SCHEDULE_PRESETS: { label: string; schedule: string }[] = [
  { label: 'Every 15 minutes', schedule: '*/15 * * * *' },
  { label: 'Every hour', schedule: '0 * * * *' },
  { label: 'Every 6 hours', schedule: '0 */6 * * *' },
  { label: 'Daily at 2:00 AM', schedule: '0 2 * * *' },
];

/** True for an IANA zone `Intl` knows — `node-cron` throws on anything else, at run time rather than save time. */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * A five-field cron expression (minute hour day month weekday).
 *
 * `node-cron` also accepts a sixth, seconds, field; it is refused here because
 * the scheduler only checks once a minute (`src/server/benchmarks/scheduler.ts`)
 * — a per-second schedule would save fine and then quietly run once a minute.
 */
export function isValidSchedule(schedule: string): boolean {
  return schedule.trim().split(/\s+/).length === 5 && cron.validate(schedule);
}

/** The next time `schedule` fires after now, in `timezone`. Null for an invalid pair. */
export function nextRunFor(schedule: string, timezone: string): Date | null {
  if (!isValidSchedule(schedule) || !isValidTimezone(timezone)) return null;
  // A stopped task: nothing is scheduled, it's only asked when it would fire.
  const task = cron.createTask(schedule, () => {}, { timezone });
  try {
    return task.getNextRuns(1)[0] ?? null;
  } finally {
    void task.destroy();
  }
}

function intFrom(value: string | number | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export function parseBenchmarkSettingsInput(body: BenchmarkSettingsInput): ParseBenchmarkSettingsResult {
  const schedule = (body.schedule ?? '').trim().replace(/\s+/g, ' ');
  if (!isValidSchedule(schedule)) {
    return {
      ok: false,
      code: 'INVALID_SCHEDULE',
      detail: 'Enter a five-part cron schedule (minute hour day month weekday), e.g. "0 * * * *" for every hour.',
    };
  }

  const timezone = (body.timezone ?? '').trim();
  if (!isValidTimezone(timezone)) {
    return { ok: false, code: 'INVALID_TIMEZONE', detail: 'Enter a time zone such as "Asia/Kolkata".' };
  }

  const minCohortSize = intFrom(body.minCohortSize);
  if (minCohortSize === null || minCohortSize < 1 || minCohortSize > 10_000) {
    return { ok: false, code: 'INVALID_MIN_COHORT', detail: 'Minimum candidates must be a whole number from 1 to 10,000.' };
  }

  const fullRebuildHours = intFrom(body.fullRebuildHours);
  if (fullRebuildHours === null || fullRebuildHours < 0 || fullRebuildHours > 24 * 90) {
    return {
      ok: false,
      code: 'INVALID_REBUILD_HOURS',
      detail: 'Full recompute interval must be 0 (only when asked) or a number of hours up to 2160 (90 days).',
    };
  }

  return {
    ok: true,
    fields: {
      enabled: body.enabled === true,
      schedule,
      timezone,
      minCohortSize,
      excludeEmptyAttempts: body.excludeEmptyAttempts === true,
      excludeStaffAttempts: body.excludeStaffAttempts === true,
      fullRecomputeEnabled: body.fullRecomputeEnabled === true,
      fullRebuildHours,
    },
  };
}
