import { describe, expect, it } from 'vitest';
import {
  SEED_DASHBOARD,
  openNextPerSkill,
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

describe('openNextPerSkill', () => {
  /**
   * The rule: a candidate always has exactly one Word paper and one Excel
   * paper available. The two skills are practised independently, so finishing
   * one must not be what unlocks the other.
   */
  const seed = SEED_DASHBOARD.allMocks;

  it('leaves exactly one Word and one Excel paper open', () => {
    const open = seed.filter((mock) => mock.state === 'today');

    expect(open.map((mock) => mock.mockType).sort()).toEqual(['excel', 'word']);
  });

  it('opens the earliest unattempted paper of each skill', () => {
    const open = seed.filter((mock) => mock.state === 'today');

    expect(open.map((mock) => mock.mockNumber)).toEqual([19, 20]);
  });

  it('keeps every later paper locked', () => {
    const later = seed.filter((mock) => mock.mockNumber > 20);

    expect(later.every((mock) => mock.state === 'locked')).toBe(true);
  });

  it('drops the unlock note from a paper it opens', () => {
    // The note explains a lock. Leaving it on an open paper would tell the
    // candidate it unlocks after a mock they can already start.
    const excel = seed.find((mock) => mock.mockNumber === 20);

    expect(excel?.state).toBe('today');
    expect(excel?.unlockNote).toBeUndefined();
  });

  it('does not open a mixed revision paper', () => {
    // A revision paper needs both skills, so it stays behind them.
    expect(seed.find((mock) => mock.mockNumber === 25)?.state).toBe('locked');
  });

  it('opens one of each skill even when the Excel paper comes first', () => {
    // Order independence: the fixture happens to run word, excel, word — this
    // pins that the rule is per skill, not "the next two rows".
    const opened = openNextPerSkill([
      { mockNumber: 1, paperName: 'p', state: 'locked', mockType: 'excel', questionCount: 100, dateLabel: '1 Sep' },
      { mockNumber: 2, paperName: 'p', state: 'locked', mockType: 'excel', questionCount: 100, dateLabel: '2 Sep' },
      { mockNumber: 3, paperName: 'p', state: 'locked', mockType: 'word', questionCount: 100, dateLabel: '3 Sep' },
    ]);

    expect(opened.map((mock) => mock.state)).toEqual(['today', 'locked', 'today']);
  });

  it('skips a skill whose papers are all attempted', () => {
    const opened = openNextPerSkill([
      { mockNumber: 1, paperName: 'p', state: 'done', mockType: 'word', questionCount: 100, dateLabel: '1 Sep' },
      { mockNumber: 2, paperName: 'p', state: 'locked', mockType: 'excel', questionCount: 100, dateLabel: '2 Sep' },
    ]);

    expect(opened.map((mock) => mock.state)).toEqual(['done', 'today']);
  });
});
