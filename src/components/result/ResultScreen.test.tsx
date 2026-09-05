import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { NOT_QUALIFIED_RESULT, QUALIFIED_RESULT } from '@/exam/result';
import { ResultScreen } from './ResultScreen';

/**
 * The screen is pure presentation over one `ExamResult`, so these assert what
 * the two approved designs say — the figures, the outcome-specific wording, and
 * that nothing on the page claims a capability the build does not have.
 */
describe('ResultScreen — qualified', () => {
  beforeEach(() => render(<ResultScreen result={QUALIFIED_RESULT} />));

  it('shows the test identity and its parameters', () => {
    expect(screen.getByText('Rajasthan Efficiency Test - 01')).toBeInTheDocument();
    expect(screen.getByText('10 Minutes')).toBeInTheDocument();
    expect(screen.getByText('15 Questions')).toBeInTheDocument();
    expect(screen.getByText('50 Marks')).toBeInTheDocument();
    expect(screen.getByText('12.5 Marks')).toBeInTheDocument();
  });

  it('leads with the qualified verdict', () => {
    const overall = screen.getByRole('region', { name: 'Overall performance' });

    expect(within(overall).getByText('Qualified')).toBeInTheDocument();
    expect(within(overall).getByText(/Great Job/)).toBeInTheDocument();
    expect(within(overall).getByText('You have Qualified!')).toBeInTheDocument();
    expect(within(overall).getByText(/which is above the qualifying marks/)).toBeInTheDocument();
    expect(within(overall).getByLabelText('28 out of 50')).toBeInTheDocument();
  });

  it('breaks the attempt down into counters', () => {
    const breakdown = screen.getByRole('region', { name: 'Score breakdown' });

    expect(within(breakdown).getByText('11')).toBeInTheDocument();
    expect(within(breakdown).getByText('(73.33%)')).toBeInTheDocument();
    expect(within(breakdown).getByText('73.33%')).toBeInTheDocument();
    expect(within(breakdown).getByText('Keep Pushing!')).toBeInTheDocument();
  });

  it('names every question and its outcome in the summary strip', () => {
    const summary = screen.getByRole('region', { name: 'Question-wise summary' });
    // Scoped to the labelled chips: the region also holds the three-item legend.
    const chips = within(summary).getAllByLabelText(/^Question \d+,/);

    expect(chips).toHaveLength(15);
    expect(within(summary).getByLabelText('Question 1, correct')).toBeInTheDocument();
    expect(within(summary).getByLabelText('Question 3, incorrect')).toBeInTheDocument();
    expect(within(summary).getByLabelText('Question 6, unattempted')).toBeInTheDocument();
  });

  it('compares the candidate against the topper and the average', () => {
    const section = screen.getByRole('region', { name: 'Compare with topper' });

    expect(within(section).getByRole('table', { name: 'TOPPER' })).toBeInTheDocument();
    expect(within(section).getByRole('table', { name: 'YOU' })).toBeInTheDocument();
    expect(within(section).getByRole('table', { name: 'AVERAGE' })).toBeInTheDocument();
    expect(within(section).getByText('197.50 / 200.00')).toBeInTheDocument();
    expect(within(section).getByText('28.00 / 50.00')).toBeInTheDocument();
    expect(within(section).getByText('01:00:00')).toBeInTheDocument();
  });

  it('totals the plotted times, not the topper’s whole paper', () => {
    const analysis = screen.getByRole('region', {
      name: 'Question-wise performance and time analysis',
    });

    expect(within(analysis).getByText('00:08:12')).toBeInTheDocument();
    expect(within(analysis).getByText('00:08:45')).toBeInTheDocument();
    // The topper's table time is 01:00:00 for 100 questions; these 15 took 04:35.
    expect(within(analysis).getByText('00:04:35')).toBeInTheDocument();
  });

  it('offers a way back and a way on, and does not pretend to have solutions', () => {
    expect(screen.getByRole('link', { name: /Back to Tests/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Attempt Another Test/ })).toHaveAttribute('href', '/');

    for (const button of screen.getAllByRole('button', { name: /View Solutions/ })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', expect.stringContaining('not available in this build'));
    }
  });
});

describe('ResultScreen — not qualified', () => {
  beforeEach(() => render(<ResultScreen result={NOT_QUALIFIED_RESULT} />));

  it('leads with the shortfall rather than congratulations', () => {
    const overall = screen.getByRole('region', { name: 'Overall performance' });

    expect(within(overall).getByText('Not Qualified')).toBeInTheDocument();
    expect(within(overall).getByText('You need 4.5 more marks to qualify.')).toBeInTheDocument();
    expect(within(overall).getByText(/which is below the qualifying marks/)).toBeInTheDocument();
    expect(within(overall).queryByText(/Great Job/)).not.toBeInTheDocument();
  });

  it('switches the encouragement to match', () => {
    expect(screen.getByText('Keep Going!')).toBeInTheDocument();
    expect(screen.queryByText('Keep Pushing!')).not.toBeInTheDocument();
  });

  it('shows the failing figures', () => {
    const breakdown = screen.getByRole('region', { name: 'Score breakdown' });

    expect(within(breakdown).getByText('40.00%')).toBeInTheDocument();
    expect(within(breakdown).getByText('8')).toBeInTheDocument();
  });
});
