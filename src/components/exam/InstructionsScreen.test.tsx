import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAPER } from '@/exam/result';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { InstructionsScreen } from './InstructionsScreen';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function open() {
  render(
    <InstructionsScreen
      attempt={SEED_ATTEMPT}
      testName={PAPER.testName}
      maximumMarks={PAPER.maximumMarks}
      qualifyingMarks={PAPER.qualifyingMarks}
    />,
  );
}

afterEach(() => {
  push.mockClear();
  cleanup();
});

describe('InstructionsScreen', () => {
  it('states the paper’s real figures, not fixed ones', () => {
    open();

    // Read from the paper itself, so a paper with different figures cannot be
    // introduced by a screen that still promises the old ones.
    expect(screen.getByText('10 Minutes')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('12.5')).toBeInTheDocument();
  });

  it('keeps Start Test shut until the terms are agreed to', async () => {
    open();
    const start = screen.getByRole('button', { name: /Start Test/ });
    expect(start).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));

    expect(start).toBeEnabled();
    await userEvent.click(start);
    expect(push).toHaveBeenCalledWith('/editor?mode=exam&lang=en');
  });

  it('carries the chosen test language into the paper', async () => {
    open();
    await userEvent.selectOptions(screen.getByLabelText('Select Your Test Language'), 'hi');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /Start Test/ }));

    expect(push).toHaveBeenCalledWith('/editor?mode=exam&lang=hi');
  });

  it('translates the instructions without changing the paper’s language', async () => {
    open();
    await userEvent.selectOptions(screen.getByLabelText('Instructions Language'), 'hi');

    expect(screen.getByText('परीक्षा निर्देश')).toBeInTheDocument();

    // The test language is a separate choice: reading in Hindi must not switch
    // the paper, or a candidate who only wanted help reading the rules would be
    // handed a Hindi paper.
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /टेस्ट शुरू करें/ }));

    expect(push).toHaveBeenCalledWith('/editor?mode=exam&lang=en');
  });

  it('describes the palette this app actually has', () => {
    open();

    expect(screen.getByText('Not Attempted')).toBeInTheDocument();
    expect(screen.getByText('Attempted')).toBeInTheDocument();
    expect(screen.getByText('Marked for Review')).toBeInTheDocument();

    // There is no "not visited" state here — attempted is derived from the
    // document — so the screen must not claim one.
    expect(screen.queryByText('Not Visited')).not.toBeInTheDocument();
  });
});
