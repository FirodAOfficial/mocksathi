import { describe, expect, it } from 'vitest';
import {
  SEED_DASHBOARD,
  challengeProgressPct,
  formatMarks,
  formatMinutesSeconds,
  streakLockCountdownLabel,
} from './seedDashboard';

describe('formatMarks', () => {
  it('adds thousands separators', () => {
    expect(formatMarks(2670)).toBe('2,670');
    expect(formatMarks(200)).toBe('200');
  });
});

describe('formatMinutesSeconds', () => {
  it.each([
    [3460, '57:40'],
    [0, '00:00'],
    [3661, '61:01'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatMinutesSeconds(seconds)).toBe(expected);
  });

  it('never goes negative', () => {
    expect(formatMinutesSeconds(-5)).toBe('00:00');
  });
});

describe('challengeProgressPct', () => {
  it('matches the mockup figure for 18 of 30 days', () => {
    expect(challengeProgressPct(SEED_DASHBOARD.challenge)).toBe(60);
  });
});

describe('streakLockCountdownLabel', () => {
  it('counts down to the lock hour later today', () => {
    const now = new Date(2026, 8, 24, 9, 42);
    expect(streakLockCountdownLabel(21, now)).toBe('11h 18m left');
  });

  it('rolls over to tomorrow once the lock hour has passed', () => {
    const now = new Date(2026, 8, 24, 22, 0);
    expect(streakLockCountdownLabel(21, now)).toBe('23h 0m left');
  });

  it('reports the full window right at the lock hour', () => {
    const now = new Date(2026, 8, 24, 21, 0);
    expect(streakLockCountdownLabel(21, now)).toBe('24h 0m left');
  });
});
