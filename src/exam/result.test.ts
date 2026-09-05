import { describe, expect, it } from 'vitest';
import {
  NOT_QUALIFIED_RESULT,
  QUALIFIED_RESULT,
  fixtureFor,
  formatClock,
  marksNeeded,
  outcomeOf,
  percent,
} from './result';

describe('outcomeOf', () => {
  it('qualifies at or above the qualifying mark', () => {
    expect(outcomeOf(QUALIFIED_RESULT)).toBe('qualified');
    expect(outcomeOf({ ...QUALIFIED_RESULT, you: { ...QUALIFIED_RESULT.you, score: 12.5 } })).toBe('qualified');
  });

  it('does not qualify below it', () => {
    expect(outcomeOf(NOT_QUALIFIED_RESULT)).toBe('not-qualified');
    expect(outcomeOf({ ...QUALIFIED_RESULT, you: { ...QUALIFIED_RESULT.you, score: 12.49 } })).toBe('not-qualified');
  });
});

describe('marksNeeded', () => {
  it('reports the shortfall shown on the not-qualified screen', () => {
    // 12.5 qualifying - 8.0 scored.
    expect(marksNeeded(NOT_QUALIFIED_RESULT)).toBe(4.5);
  });

  it('is zero once qualified, never negative', () => {
    expect(marksNeeded(QUALIFIED_RESULT)).toBe(0);
  });
});

describe('formatClock', () => {
  it.each([
    [492, '00:08:12'],
    [525, '00:08:45'],
    [275, '00:04:35'],
    [3600, '01:00:00'],
    [0, '00:00:00'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });

  it('clamps negatives rather than showing a negative clock', () => {
    expect(formatClock(-10)).toBe('00:00:00');
  });
});

describe('percent', () => {
  it('rounds to two places', () => {
    expect(percent(11, 15)).toBe(73.33);
    expect(percent(6, 15)).toBe(40);
  });

  it('returns zero for an empty paper instead of NaN', () => {
    expect(percent(0, 0)).toBe(0);
  });
});

describe('design fixtures', () => {
  it('matches the qualified screen', () => {
    expect(QUALIFIED_RESULT.you).toMatchObject({ score: 28, accuracy: 73.33, correct: 11, wrong: 3, unattempted: 1 });
    expect(formatClock(QUALIFIED_RESULT.you.timeSeconds)).toBe('00:08:12');
  });

  it('matches the not-qualified screen', () => {
    expect(NOT_QUALIFIED_RESULT.you).toMatchObject({ score: 8, accuracy: 40, correct: 6, wrong: 8, unattempted: 1 });
    expect(formatClock(NOT_QUALIFIED_RESULT.you.timeSeconds)).toBe('00:05:12');
  });

  it('keeps the per-question outcomes consistent with the headline counts', () => {
    for (const fixture of [QUALIFIED_RESULT, NOT_QUALIFIED_RESULT]) {
      const tally = { correct: 0, incorrect: 0, unattempted: 0 };
      for (const question of fixture.questions) tally[question.outcome] += 1;

      expect(tally.correct).toBe(fixture.you.correct);
      expect(tally.incorrect).toBe(fixture.you.wrong);
      expect(tally.unattempted).toBe(fixture.you.unattempted);
      expect(fixture.questions).toHaveLength(fixture.totalQuestions);
    }
  });

  it('selects the fixture by outcome', () => {
    expect(fixtureFor('qualified')).toBe(QUALIFIED_RESULT);
    expect(fixtureFor('not-qualified')).toBe(NOT_QUALIFIED_RESULT);
  });
});
