import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { useExamStore } from '@/state/examStore';
import { ExamSummaryPanel } from './ExamSummaryPanel';
import { ResultDialog } from './ResultDialog';

describe('ResultDialog', () => {
  const answered = new Set([1, 2, 3]);

  it('reports what was handed in', () => {
    render(
      <ResultDialog attempt={SEED_ATTEMPT} answered={answered} reason="candidate" onClose={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'Paper submitted' })).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('/15')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('20% of the paper attempted')).toBeInTheDocument();
    // Attempted, not attempted, marked for review.
    expect(within(dialog).getAllByRole('definition').map((cell) => cell.textContent)).toEqual([
      '3',
      '12',
      '2',
    ]);
  });

  it('says so when the clock ran out rather than the candidate submitting', () => {
    render(<ResultDialog attempt={SEED_ATTEMPT} answered={answered} reason="timeout" onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Time up — paper submitted' })).toBeInTheDocument();
    expect(screen.getByText(/submitted automatically/)).toBeInTheDocument();
  });

  it('does not invent a score, because nothing marks the answers', () => {
    render(<ResultDialog attempt={SEED_ATTEMPT} answered={answered} reason="candidate" onClose={vi.fn()} />);

    expect(screen.getByText(/not marked in this build/)).toBeInTheDocument();
  });

  it('closes when acknowledged', async () => {
    const onClose = vi.fn();
    render(<ResultDialog attempt={SEED_ATTEMPT} answered={answered} reason="timeout" onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('auto-submit when time runs out', () => {
  beforeEach(() => {
    useExamStore.setState({
      attempt: SEED_ATTEMPT,
      selectedNumber: 1,
      answers: {},
      submittedBy: null,
      resultSeen: false,
    });
    vi.useFakeTimers();
  });

  it('stores the open answer and closes the paper as a timeout', async () => {
    const onSaveAnswer = vi.fn();
    render(<ExamSummaryPanel onClearAnswer={vi.fn()} onSaveAnswer={onSaveAnswer} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEED_ATTEMPT.durationSeconds * 1000 + 1000);
    });

    // Saving before locking is what makes this an auto-submit rather than a
    // discard of whatever was being typed as the clock ran out.
    expect(onSaveAnswer).toHaveBeenCalled();
    expect(useExamStore.getState().submittedBy).toBe('timeout');

    vi.useRealTimers();
  });

  it('records the candidate as the submitter if they got there first', async () => {
    render(<ExamSummaryPanel onClearAnswer={vi.fn()} onSaveAnswer={vi.fn()} />);

    act(() => useExamStore.getState().submit('candidate'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEED_ATTEMPT.durationSeconds * 1000 + 1000);
    });

    expect(useExamStore.getState().submittedBy).toBe('candidate');

    vi.useRealTimers();
  });
});
