import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { useExamStore } from '@/state/examStore';
import { ExamSummaryPanel } from './ExamSummaryPanel';

const noop = vi.fn();

function renderPanel(onClearAnswer = noop) {
  return render(<ExamSummaryPanel onClearAnswer={onClearAnswer} onSaveAnswer={noop} />);
}

describe('ExamSummaryPanel', () => {
  beforeEach(() => {
    useExamStore.setState({
      attempt: SEED_ATTEMPT,
      selectedNumber: 1,
      answers: {},
      submittedBy: null,
      resultSeen: false,
    });
    vi.clearAllMocks();
  });

  it('shows the candidate and a palette entry per question', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Praveen' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Question \d+,/ })).toHaveLength(15);
  });

  it('derives the legend counts from what has actually been typed', () => {
    renderPanel();
    const legend = screen.getByRole('list');

    expect(within(legend).getByText('Attempted').textContent).toBe('0Attempted');
    expect(within(legend).getByText('Not Attempted').textContent).toBe('15Not Attempted');
    expect(within(legend).getByText('Marked for Review').textContent).toBe('2Marked for Review');
  });

  it('moves a question from not attempted to attempted when it gains an answer', () => {
    const { rerender } = renderPanel();

    act(() => useExamStore.setState({ answers: { 1: { type: 'doc' }, 2: { type: 'doc' } } }));
    rerender(<ExamSummaryPanel onClearAnswer={noop} onSaveAnswer={noop} />);

    const legend = screen.getByRole('list');
    expect(within(legend).getByText('Attempted').textContent).toBe('2Attempted');
    expect(within(legend).getByText('Not Attempted').textContent).toBe('13Not Attempted');
  });

  it('states each question status in its accessible name', () => {
    act(() => useExamStore.setState({ answers: { 1: { type: 'doc' } } }));
    renderPanel();

    expect(screen.getByRole('button', { name: 'Question 1, attempted' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Question 3, not attempted' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Question 12, not attempted, marked for review' }),
    ).toBeInTheDocument();
  });

  it('selects a question from the palette', async () => {
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Question 7, not attempted' }));

    expect(useExamStore.getState().selectedNumber).toBe(7);
  });

  it('filters the palette by status', async () => {
    act(() => useExamStore.setState({ answers: { 2: { type: 'doc' }, 5: { type: 'doc' } } }));
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: /Filter/ }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Attempted' }));

    expect(screen.getAllByRole('button', { name: /^Question \d+,/ }).map((cell) => cell.textContent)).toEqual([
      '2',
      '5',
    ]);
  });

  it('filters to the questions marked for review, cutting across status', async () => {
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: /Filter/ }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Marked for review' }));

    expect(screen.getAllByRole('button', { name: /^Question \d+,/ }).map((cell) => cell.textContent)).toEqual([
      '12',
      '14',
    ]);
  });
});

describe('question actions', () => {
  beforeEach(() => {
    useExamStore.setState({
      attempt: SEED_ATTEMPT,
      selectedNumber: 5,
      answers: {},
      submittedBy: null,
      resultSeen: false,
    });
    vi.clearAllMocks();
  });

  it('offers no button that could contradict what has been typed', () => {
    renderPanel();

    // Attempted state is derived from the answer document, so there is nothing
    // to press — the panel states it instead.
    expect(screen.queryByRole('button', { name: 'Attempted' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Not Attempted' })).not.toBeInTheDocument();
    expect(screen.getByText(/this question is/i)).toHaveTextContent('not attempted');
  });

  it('reports the open question as attempted once it has an answer', () => {
    act(() => useExamStore.setState({ answers: { 5: { type: 'doc' } } }));
    renderPanel();

    expect(screen.getByText(/this question is/i)).toHaveTextContent('attempted');
  });

  it('toggles mark for review', async () => {
    renderPanel();
    const button = screen.getByRole('button', { name: 'Mark for Review' });

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('only offers Clear once something has been typed', async () => {
    const onClear = vi.fn();
    renderPanel(onClear);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();

    act(() => useExamStore.setState({ answers: { 5: { type: 'doc' } } }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onClear).toHaveBeenCalledOnce();
  });

  it('steps between questions and stops at both ends', async () => {
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(useExamStore.getState().selectedNumber).toBe(6);

    await userEvent.click(screen.getByRole('button', { name: /Previous/ }));
    expect(useExamStore.getState().selectedNumber).toBe(5);

    // Driving the store directly needs act(), or the assertion runs against
    // the render from before the update.
    act(() => useExamStore.setState({ selectedNumber: 1 }));
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();

    act(() => useExamStore.setState({ selectedNumber: 15 }));
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
  });

  it('asks for confirmation before submitting, and does not submit on cancel', async () => {
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('heading', { name: 'Submit paper' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(useExamStore.getState().submittedBy).toBeNull();
  });

  it('locks the paper once submission is confirmed', async () => {
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    // The panel button and the dialog's confirm button share a name.
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit' }));

    expect(useExamStore.getState().submittedBy).toBe('candidate');
    expect(screen.getByRole('button', { name: 'Submitted' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mark for Review' })).toBeDisabled();
  });

  it('disables the recording actions when time runs out, but not navigation', () => {
    act(() => useExamStore.setState({ submittedBy: 'timeout' }));
    renderPanel();

    expect(screen.getByRole('button', { name: 'Mark for Review' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    // Navigation stays live so the paper can still be read back.
    expect(screen.getByRole('button', { name: /Next/ })).toBeEnabled();
  });
});
