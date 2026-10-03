import { describe, expect, it } from 'vitest';
import { isValidSchedule, nextRunFor, parseBenchmarkSettingsInput } from './benchmarkSettingsInput';

const VALID = {
  enabled: true,
  schedule: '0 * * * *',
  timezone: 'Asia/Kolkata',
  minCohortSize: '3',
  excludeEmptyAttempts: true,
  excludeStaffAttempts: false,
  fullRecomputeEnabled: true,
  fullRebuildHours: '24',
};

describe('parseBenchmarkSettingsInput', () => {
  it('accepts a valid form and normalises it', () => {
    const parsed = parseBenchmarkSettingsInput({ ...VALID, schedule: '  */15   * * * * ' });
    expect(parsed).toEqual({
      ok: true,
      fields: {
        enabled: true,
        schedule: '*/15 * * * *',
        timezone: 'Asia/Kolkata',
        minCohortSize: 3,
        excludeEmptyAttempts: true,
        excludeStaffAttempts: false,
        fullRecomputeEnabled: true,
        fullRebuildHours: 24,
      },
    });
  });

  it.each([
    [{ schedule: 'every hour' }, 'INVALID_SCHEDULE'],
    // Six fields (seconds) would save and then quietly run once a minute.
    [{ schedule: '0 0 * * * *' }, 'INVALID_SCHEDULE'],
    [{ timezone: 'Mars/Olympus' }, 'INVALID_TIMEZONE'],
    [{ minCohortSize: '0' }, 'INVALID_MIN_COHORT'],
    [{ minCohortSize: 'three' }, 'INVALID_MIN_COHORT'],
    [{ fullRebuildHours: '-1' }, 'INVALID_REBUILD_HOURS'],
  ])('refuses %o', (override, code) => {
    const parsed = parseBenchmarkSettingsInput({ ...VALID, ...override });
    expect(parsed).toMatchObject({ ok: false, code });
  });

  it('treats a missing checkbox as off, never on', () => {
    const parsed = parseBenchmarkSettingsInput({ schedule: '0 * * * *', timezone: 'UTC', minCohortSize: 1, fullRebuildHours: 0 });
    expect(parsed).toMatchObject({ ok: true, fields: { enabled: false, excludeEmptyAttempts: false, excludeStaffAttempts: false, fullRecomputeEnabled: false } });
  });
});

describe('nextRunFor', () => {
  it('finds the next firing in the given zone', () => {
    const next = nextRunFor('0 2 * * *', 'Asia/Kolkata');
    expect(next).toBeInstanceOf(Date);
    // 02:00 IST is 20:30 UTC.
    expect(next!.getUTCHours()).toBe(20);
    expect(next!.getUTCMinutes()).toBe(30);
    expect(next!.getTime()).toBeGreaterThan(Date.now());
  });

  it('is null for anything invalid rather than throwing', () => {
    expect(nextRunFor('nonsense', 'UTC')).toBeNull();
    expect(nextRunFor('0 * * * *', 'Not/AZone')).toBeNull();
    expect(isValidSchedule('0 * * * *')).toBe(true);
  });
});
