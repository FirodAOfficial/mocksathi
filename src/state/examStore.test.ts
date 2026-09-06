import { beforeEach, describe, expect, it } from 'vitest';
import { answeredSet, selectIsLocked, useExamStore } from './examStore';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { allQuestions } from '@/exam/types';

const doc = { type: 'doc', content: [] } as never;

beforeEach(() => useExamStore.getState().startAttempt('en'));

describe('startAttempt', () => {
  it('leaves nothing of the previous paper behind', () => {
    const store = useExamStore.getState();

    // Sit a paper: answer something, flag something, and submit it.
    store.saveAnswer(3, doc);
    store.toggleMarkedForReview(5);
    store.selectQuestion(7);
    store.submit('candidate');

    expect(selectIsLocked(useExamStore.getState())).toBe(true);

    // The store is a module singleton, so walking back to the instructions and
    // starting again never reloads the page. Without this reset the candidate
    // lands straight back on the result screen.
    useExamStore.getState().startAttempt('en');
    const fresh = useExamStore.getState();

    expect(fresh.submittedBy).toBeNull();
    expect(answeredSet(fresh.answers).size).toBe(0);
    expect(fresh.timePerQuestion).toEqual({});
    expect(fresh.selectedNumber).toBe(allQuestions(SEED_ATTEMPT)[0]!.number);
    expect(allQuestions(fresh.attempt).some((question) => question.bookmarked)).toBe(false);
  });

  it('starts the clock, and restarts it for the next paper', () => {
    const first = useExamStore.getState().startedAt;
    expect(first).not.toBeNull();

    useExamStore.getState().startAttempt('hi');
    const second = useExamStore.getState().startedAt;

    expect(second).not.toBeNull();
    expect(second!).toBeGreaterThanOrEqual(first!);
    expect(useExamStore.getState().language).toBe('hi');
  });
});
