import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamTimer } from './ExamTimer';

/** Advances both the clock and pending intervals, then lets React flush. */
async function advance(seconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(seconds * 1000);
  });
}

describe('ExamTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts at the full duration', () => {
    render(<ExamTimer durationSeconds={600} />);

    expect(screen.getByRole('timer')).toHaveTextContent('10:00');
  });

  it('counts down as time passes', async () => {
    render(<ExamTimer durationSeconds={600} />);

    await advance(1);
    expect(screen.getByRole('timer')).toHaveTextContent('09:59');

    await advance(59);
    expect(screen.getByRole('timer')).toHaveTextContent('09:00');
  });

  it('stays accurate across a long gap, as when the tab was in the background', async () => {
    render(<ExamTimer durationSeconds={600} />);

    // A decrementing counter would drift here; deriving from a fixed deadline
    // means the clock is right however coarsely the ticks actually fired.
    await advance(300);

    expect(screen.getByRole('timer')).toHaveTextContent('05:00');
  });

  it('warns in the final minute', async () => {
    render(<ExamTimer durationSeconds={600} />);
    expect(screen.getByRole('status')).toHaveTextContent('');

    await advance(541);

    expect(screen.getByRole('timer')).toHaveTextContent('00:59');
    expect(screen.getByRole('status')).toHaveTextContent('Less than a minute left');
  });

  it('stops at zero and says so, never going negative', async () => {
    render(<ExamTimer durationSeconds={600} />);

    await advance(700);

    expect(screen.getByRole('timer')).toHaveTextContent('00:00');
    expect(screen.getByRole('status')).toHaveTextContent("Time's up");
  });

  it('reports progress to assistive technology', async () => {
    render(<ExamTimer durationSeconds={600} />);

    await advance(120);

    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuemax', '600');
    expect(progress).toHaveAttribute('aria-valuenow', '480');
    expect(progress).toHaveAttribute('aria-valuetext', '08:00 remaining');
  });
});
