import { describe, expect, it } from 'vitest';
import { SEED_ATTEMPT } from './seedAttempt';
import { allQuestions, findQuestion, formatDuration, statusOf, summarise, type ExamAttempt } from './types';

const attempt = (count: number, bookmarked: number[] = []): ExamAttempt => ({
  candidateName: 'Test',
  durationSeconds: 600,
  sections: [
    {
      name: 'Section A',
      questions: Array.from({ length: count }, (_, index) => ({
        number: index + 1,
        bookmarked: bookmarked.includes(index + 1),
        prompt: `Q${index + 1}`,
      })),
    },
  ],
});

describe('statusOf', () => {
  it('counts a question as attempted once it has been edited', () => {
    const question = attempt(1).sections[0]!.questions[0]!;

    expect(statusOf(question, new Set([1]))).toBe('attempted');
  });

  it('counts a skipped question as not attempted', () => {
    const question = attempt(1).sections[0]!.questions[0]!;

    // Visiting a question and moving on leaves nothing behind, so it stays
    // unattempted — there is no separate "seen but skipped" state.
    expect(statusOf(question, new Set())).toBe('unattempted');
  });
});

describe('summarise', () => {
  it('splits the paper into attempted and not attempted', () => {
    expect(summarise(attempt(5), new Set([1, 3]))).toEqual({
      attempted: 2,
      unattempted: 3,
      markedForReview: 0,
      total: 5,
    });
  });

  it('counts questions flagged for review independently of whether they were answered', () => {
    expect(summarise(attempt(5, [2, 4]), new Set([2])).markedForReview).toBe(2);
  });

  it('handles an empty paper without producing NaN', () => {
    expect(summarise(attempt(0), new Set())).toEqual({
      attempted: 0,
      unattempted: 0,
      markedForReview: 0,
      total: 0,
    });
  });

  it('starts the seed attempt with nothing answered', () => {
    expect(allQuestions(SEED_ATTEMPT)).toHaveLength(15);
    expect(summarise(SEED_ATTEMPT, new Set())).toEqual({
      attempted: 0,
      unattempted: 15,
      markedForReview: 2,
      total: 15,
    });
  });
});

describe('findQuestion', () => {
  it('finds a question by number and returns undefined past the end', () => {
    expect(findQuestion(SEED_ATTEMPT, 3)?.number).toBe(3);
    expect(findQuestion(SEED_ATTEMPT, 99)).toBeUndefined();
  });
});

describe('formatDuration', () => {
  it.each([
    [600, '10:00'],
    [599, '09:59'],
    [61, '01:01'],
    [60, '01:00'],
    [9, '00:09'],
    [0, '00:00'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it('floors fractional seconds instead of rounding up past the limit', () => {
    expect(formatDuration(59.9)).toBe('00:59');
  });

  it('clamps negatives to zero rather than showing a negative clock', () => {
    expect(formatDuration(-5)).toBe('00:00');
  });
});
