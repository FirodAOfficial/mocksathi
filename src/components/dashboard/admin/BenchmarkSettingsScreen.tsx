'use client';

import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import headerStyles from '@/components/dashboard/AnalysisScreen.module.css';
import formStyles from './PlanForm.module.css';
import styles from './BenchmarkSettingsScreen.module.css';

/** Mirrors `SCHEDULE_PRESETS` in `src/db/benchmarkSettingsInput.ts` — kept here so `node-cron` stays out of the browser bundle. */
const PRESETS: { label: string; schedule: string }[] = [
  { label: 'Every 15 minutes', schedule: '*/15 * * * *' },
  { label: 'Every hour', schedule: '0 * * * *' },
  { label: 'Every 6 hours', schedule: '0 */6 * * *' },
  { label: 'Daily at 2:00 AM', schedule: '0 2 * * *' },
];
const CUSTOM = 'custom';

export interface BenchmarkSettingsValues {
  enabled: boolean;
  schedule: string;
  timezone: string;
  minCohortSize: number;
  excludeEmptyAttempts: boolean;
  excludeStaffAttempts: boolean;
  fullRecomputeEnabled: boolean;
  fullRebuildHours: number;
}

/** Everything about the last and next run, pre-formatted on the server. */
export interface BenchmarkStatus {
  running: boolean;
  nextRunAt: string | null;
  computedThrough: string | null;
  lastFullRebuildAt: string | null;
  rebuildPending: boolean;
  /** As saved — the run buttons follow the saved setting, not an unsaved checkbox. */
  fullRecomputeEnabled: boolean;
  lastRun: {
    status: string;
    mode: string | null;
    trigger: string | null;
    finishedAt: string | null;
    rowsScanned: number | null;
    rowsChanged: number | null;
    testsUpdated: number | null;
    durationMs: number | null;
    error: string | null;
  } | null;
  papersWithFigures: number;
  sittingsCounted: number;
  inProcessScheduler: boolean;
  cronEndpointConfigured: boolean;
}

interface FormState {
  enabled: boolean;
  preset: string;
  schedule: string;
  timezone: string;
  minCohortSize: string;
  excludeEmptyAttempts: boolean;
  excludeStaffAttempts: boolean;
  fullRecomputeEnabled: boolean;
  fullRebuildHours: string;
}

const MODE_LABEL: Record<string, string> = {
  incremental: 'Incremental',
  recheck: 'Re-check of all sittings',
  full: 'Full recompute',
};

const TRIGGER_LABEL: Record<string, string> = {
  scheduler: 'In-app scheduler',
  'cron-endpoint': 'External cron',
  admin: 'Run by an admin',
};

function stateFrom(settings: BenchmarkSettingsValues): FormState {
  const preset = PRESETS.find((option) => option.schedule === settings.schedule);
  return {
    enabled: settings.enabled,
    preset: preset ? preset.schedule : CUSTOM,
    schedule: settings.schedule,
    timezone: settings.timezone,
    minCohortSize: String(settings.minCohortSize),
    excludeEmptyAttempts: settings.excludeEmptyAttempts,
    excludeStaffAttempts: settings.excludeStaffAttempts,
    fullRecomputeEnabled: settings.fullRecomputeEnabled,
    fullRebuildHours: String(settings.fullRebuildHours),
  };
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/**
 * Admin settings for the best/average ("topper"/"average") computation that
 * feeds every result page's comparison — `sdd/benchmarks.md`.
 */
export function BenchmarkSettingsScreen({
  settings,
  status,
}: {
  settings: BenchmarkSettingsValues;
  status: BenchmarkStatus;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(() => stateFrom(settings));
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<'incremental' | 'full' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = event.target;
    setValues((current) => {
      if (name === 'preset') {
        return { ...current, preset: value, schedule: value === CUSTOM ? current.schedule : value };
      }
      return { ...current, [name]: type === 'checkbox' ? (event.target as HTMLInputElement).checked : value };
    });
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const response = await fetch('/api/admin/benchmarks', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: values.enabled,
          schedule: values.schedule,
          timezone: values.timezone,
          minCohortSize: values.minCohortSize,
          excludeEmptyAttempts: values.excludeEmptyAttempts,
          excludeStaffAttempts: values.excludeStaffAttempts,
          fullRecomputeEnabled: values.fullRecomputeEnabled,
          fullRebuildHours: values.fullRebuildHours,
        }),
      });
      const body = (await response.json().catch(() => null)) as { detail?: string; rebuildRequested?: boolean } | null;
      if (!response.ok) {
        setError(body?.detail ?? 'Could not save the settings. Try again.');
        return;
      }
      setNotice(
        body?.rebuildRequested
          ? values.fullRecomputeEnabled
            ? 'Saved. Who counts has changed, so the next run recomputes every paper from scratch.'
            : 'Saved. Who counts has changed, so the next run re-checks every sitting under the new rules.'
          : 'Saved.',
      );
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleRun(mode: 'incremental' | 'full') {
    setError(null);
    setNotice(null);
    setRunning(mode);
    try {
      const response = await fetch('/api/admin/benchmarks/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const body = (await response.json().catch(() => null)) as {
        status?: string;
        reason?: string;
        mode?: string;
        rowsChanged?: number;
        rowsScanned?: number;
        testsUpdated?: number;
        error?: string;
      } | null;

      if (body?.status === 'skipped') {
        setError(
          body.reason === 'full-recompute-disabled'
            ? 'Full recompute is switched off. Turn it on under "Full recompute" below to run one.'
            : 'A run is already in progress. Try again when it finishes.',
        );
      } else if (!response.ok || body?.status !== 'success') {
        setError(body?.error ? `The run failed: ${body.error}` : 'The run failed. Try again.');
      } else {
        setNotice(
          `${MODE_LABEL[body.mode ?? ''] ?? 'Run'} finished: ` +
            `${body.rowsChanged ?? 0} of ${body.rowsScanned ?? 0} sittings changed, ` +
            `${body.testsUpdated ?? 0} paper${body.testsUpdated === 1 ? '' : 's'} updated.`,
        );
      }
      router.refresh();
    } finally {
      setRunning(null);
    }
  }

  const lastRun = status.lastRun;

  return (
    <>
      <div className={headerStyles.header}>
        <h1 className={headerStyles.title}>Best &amp; Average Scores</h1>
        <p className={headerStyles.subtitle}>
          How the &ldquo;best&rdquo; and &ldquo;average&rdquo; figures on every result page are computed, and when.
        </p>
      </div>

      {/* Status ------------------------------------------------------------ */}
      <div className={styles.statusGrid}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Last run</div>
          <div className={styles.tileValue}>
            {status.running ? (
              <span className={styles.badgeRunning}>Running…</span>
            ) : lastRun ? (
              <span className={lastRun.status === 'success' ? styles.badgeOk : styles.badgeFailed}>
                {lastRun.status === 'success' ? '✓ Succeeded' : '✕ Failed'}
              </span>
            ) : (
              <span className={styles.badgeIdle}>Never run</span>
            )}
          </div>
          <div className={styles.tileDetail}>
            {lastRun?.finishedAt ?? '—'}
            {lastRun?.trigger ? ` · ${TRIGGER_LABEL[lastRun.trigger] ?? lastRun.trigger}` : ''}
          </div>
        </div>

        <div className={styles.tile}>
          <div className={styles.tileLabel}>Next scheduled run</div>
          <div className={styles.tileValueText}>{status.nextRunAt ?? (settings.enabled ? 'On the next tick' : 'Schedule off')}</div>
          <div className={styles.tileDetail}>
            {!status.rebuildPending
              ? 'Incremental — only what changed'
              : status.fullRecomputeEnabled
                ? 'Will recompute from scratch'
                : 'Will re-check every sitting'}
          </div>
        </div>

        <div className={styles.tile}>
          <div className={styles.tileLabel}>Last compute time</div>
          <div className={styles.tileValueText}>{status.computedThrough ?? '—'}</div>
          <div className={styles.tileDetail}>Next incremental run reads sittings changed after this</div>
        </div>

        <div className={styles.tile}>
          <div className={styles.tileLabel}>Coverage</div>
          <div className={styles.tileValueText}>
            {status.papersWithFigures.toLocaleString('en-IN')} paper{status.papersWithFigures === 1 ? '' : 's'}
          </div>
          <div className={styles.tileDetail}>{status.sittingsCounted.toLocaleString('en-IN')} sittings counted</div>
        </div>
      </div>

      {lastRun && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>Last run details</p>
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>Mode</dt>
              <dd>{MODE_LABEL[lastRun.mode ?? ''] ?? '—'}</dd>
            </div>
            <div>
              <dt>Sittings read</dt>
              <dd>{lastRun.rowsScanned?.toLocaleString('en-IN') ?? '—'}</dd>
            </div>
            <div>
              <dt>Sittings changed</dt>
              <dd>{lastRun.rowsChanged?.toLocaleString('en-IN') ?? '—'}</dd>
            </div>
            <div>
              <dt>Papers updated</dt>
              <dd>{lastRun.testsUpdated?.toLocaleString('en-IN') ?? '—'}</dd>
            </div>
            <div>
              <dt>Took</dt>
              <dd>{formatDuration(lastRun.durationMs)}</dd>
            </div>
            <div>
              <dt>Last full recompute</dt>
              <dd>{status.lastFullRebuildAt ?? '—'}</dd>
            </div>
          </dl>
          {lastRun.error && <p className={formStyles.error}>{lastRun.error}</p>}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.cardTitle}>Run now</p>
            <p className={styles.cardNote}>
              Runs straight away, even with the schedule off. An incremental run only reads sittings submitted or
              changed since the last compute time; a full recompute resets every paper&apos;s totals and rebuilds them.
            </p>
          </div>
          <div className={styles.runButtons}>
            <button
              type="button"
              className={formStyles.primary}
              disabled={running !== null || status.running}
              onClick={() => handleRun('incremental')}
            >
              {running === 'incremental' ? 'Running…' : 'Run now'}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={running !== null || status.running || !status.fullRecomputeEnabled}
              title={status.fullRecomputeEnabled ? undefined : 'Full recompute is switched off below'}
              onClick={() => handleRun('full')}
            >
              {running === 'full' ? 'Recomputing…' : 'Recompute from scratch'}
            </button>
          </div>
        </div>
      </div>

      {(error || notice) && (
        <p className={error ? formStyles.error : styles.notice} role="status">
          {error ?? notice}
        </p>
      )}

      {/* Settings ---------------------------------------------------------- */}
      <form className={styles.form} onSubmit={handleSave} noValidate>
        <div className={formStyles.section}>
          <p className={styles.sectionTitle}>Schedule</p>

          <label className={`${formStyles.checkboxRow} ${styles.spaced}`}>
            <input type="checkbox" name="enabled" checked={values.enabled} onChange={handleChange} />
            Run automatically on a schedule
          </label>

          <div className={formStyles.grid2}>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="preset">
                How often
              </label>
              <select id="preset" name="preset" className={formStyles.input} value={values.preset} onChange={handleChange}>
                {PRESETS.map((option) => (
                  <option key={option.schedule} value={option.schedule}>
                    {option.label}
                  </option>
                ))}
                <option value={CUSTOM}>Custom (cron expression)</option>
              </select>
            </div>

            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="schedule">
                Cron expression <span className={formStyles.optional}>(min hour day month weekday)</span>
              </label>
              <input
                id="schedule"
                name="schedule"
                className={`${formStyles.input} ${styles.mono}`}
                value={values.schedule}
                onChange={handleChange}
                readOnly={values.preset !== CUSTOM}
                spellCheck={false}
              />
            </div>

            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="timezone">
                Time zone
              </label>
              <input id="timezone" name="timezone" className={formStyles.input} value={values.timezone} onChange={handleChange} />
            </div>
          </div>

          <p className={styles.help}>
            Each scheduled run is incremental: it picks up from the last compute time and applies only what changed.
          </p>
        </div>

        <div className={formStyles.section}>
          <p className={styles.sectionTitle}>Full recompute</p>

          <label className={`${formStyles.checkboxRow} ${styles.spaced}`}>
            <input
              type="checkbox"
              name="fullRecomputeEnabled"
              checked={values.fullRecomputeEnabled}
              onChange={handleChange}
            />
            Allow full recompute (reset every paper&apos;s totals and rebuild them from all sittings)
          </label>

          <div className={formStyles.grid2}>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="fullRebuildHours">
                Automatically every <span className={formStyles.optional}>(hours, 0 = only on request)</span>
              </label>
              <input
                id="fullRebuildHours"
                name="fullRebuildHours"
                type="number"
                min={0}
                className={formStyles.input}
                value={values.fullRebuildHours}
                onChange={handleChange}
                disabled={!values.fullRecomputeEnabled}
              />
            </div>
          </div>

          <p className={styles.help}>
            {values.fullRecomputeEnabled ? (
              <>
                A full recompute catches what an incremental run can&apos;t see — sittings removed when an account is
                deleted — and clears rounding drift. It also runs when &ldquo;who counts&rdquo; changes.
              </>
            ) : (
              <>
                Off: nothing ever resets the totals — not the timer, not a change to &ldquo;who counts&rdquo;, not the
                button above. When the rules change, the next run re-checks every sitting instead, which is exact.
                The one thing it can&apos;t correct is sittings removed when an account is deleted: those stay counted
                until full recompute is turned back on and run.
              </>
            )}
          </p>
        </div>

        <div className={formStyles.section}>
          <p className={styles.sectionTitle}>Who counts</p>

          <div className={formStyles.grid2}>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="minCohortSize">
                Show figures once a paper has <span className={formStyles.optional}>(candidates)</span>
              </label>
              <input
                id="minCohortSize"
                name="minCohortSize"
                type="number"
                min={1}
                className={formStyles.input}
                value={values.minCohortSize}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className={styles.checks}>
            <label className={formStyles.checkboxRow}>
              <input
                type="checkbox"
                name="excludeEmptyAttempts"
                checked={values.excludeEmptyAttempts}
                onChange={handleChange}
              />
              Leave out sittings where no question was answered
            </label>
            <label className={formStyles.checkboxRow}>
              <input
                type="checkbox"
                name="excludeStaffAttempts"
                checked={values.excludeStaffAttempts}
                onChange={handleChange}
              />
              Leave out admin and support accounts&apos; sittings
            </label>
          </div>

          <p className={styles.help}>
            Each candidate counts once per paper, with their latest sitting. &ldquo;Best&rdquo; is the highest score
            (ties go to higher accuracy, then less time). Changing either checkbox makes the next run re-read every
            sitting under the new rules — a full recompute, or a re-check if full recompute is off.
          </p>
        </div>

        <div className={formStyles.actions}>
          <button type="submit" className={formStyles.primary} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>

      <div className={styles.triggers}>
        <p className={styles.cardTitle}>What triggers a scheduled run</p>
        <ul>
          <li>
            <span className={status.inProcessScheduler ? styles.dotOn : styles.dotOff} aria-hidden="true" />
            <strong>In-app scheduler</strong> ({status.inProcessScheduler ? 'active on this server' : 'off on this server'}
            ) — checks every minute whether a run is due. Works on a long-running server; off on Vercel, where functions
            sleep between requests.
          </li>
          <li>
            <span className={status.cronEndpointConfigured ? styles.dotOn : styles.dotOff} aria-hidden="true" />
            <strong>External cron</strong> (
            {status.cronEndpointConfigured ? 'CRON_SECRET is set' : 'needs CRON_SECRET to be set'}) — Vercel Cron calls{' '}
            <code>/api/cron/benchmarks</code> per <code>vercel.json</code>. It can only run as often as that file says,
            so a schedule more frequent than it is capped to its rate.
          </li>
        </ul>
      </div>
    </>
  );
}
