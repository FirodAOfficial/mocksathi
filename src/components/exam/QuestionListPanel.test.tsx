import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_ATTEMPT } from '@/exam/seedAttempt';
import { useExamStore } from '@/state/examStore';
import { QuestionListPanel } from './QuestionListPanel';

/**
 * Covers selection and keyboard navigation. The scroll-into-view behaviour is
 * not asserted here: jsdom performs no layout, so every element reports a zero
 * rect and the calculation has nothing to work from. It was verified in a real
 * browser instead.
 */
describe('QuestionListPanel', () => {
  beforeEach(() => {
    useExamStore.setState({
      attempt: SEED_ATTEMPT,
      selectedNumber: 1,
      answers: {},
      submittedBy: null,
      resultSeen: false,
    });
  });

  it('lists every question in the paper', () => {
    render(<QuestionListPanel />);

    expect(screen.getAllByRole('option')).toHaveLength(15);
  });

  it('shows a marker on questions that have been edited', () => {
    act(() => useExamStore.setState({ answers: { 2: { type: 'doc' } } }));
    render(<QuestionListPanel />);

    // Only edited questions are stored, so the marker follows the answer map.
    expect(screen.getAllByLabelText('edited')).toHaveLength(1);
  });

  it('marks the selected question, and only that one', () => {
    render(<QuestionListPanel />);

    const selected = screen.getAllByRole('option').filter((option) => option.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('1');
  });

  it('selects a question when it is clicked', async () => {
    render(<QuestionListPanel />);

    await userEvent.click(screen.getByText(/A sum of money doubles itself in 8 years/));

    expect(useExamStore.getState().selectedNumber).toBe(3);
  });

  it('moves the selection with the arrow keys', async () => {
    render(<QuestionListPanel />);
    const list = screen.getByRole('listbox');
    list.focus();

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(useExamStore.getState().selectedNumber).toBe(3);

    await userEvent.keyboard('{ArrowUp}');
    expect(useExamStore.getState().selectedNumber).toBe(2);
  });

  it('stops at the ends of the paper rather than wrapping', async () => {
    render(<QuestionListPanel />);
    const list = screen.getByRole('listbox');
    list.focus();

    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(useExamStore.getState().selectedNumber).toBe(1);

    act(() => useExamStore.setState({ selectedNumber: 15 }));
    await userEvent.keyboard('{ArrowDown}');
    expect(useExamStore.getState().selectedNumber).toBe(15);
  });

  it('points assistive technology at the active question', () => {
    act(() => useExamStore.setState({ selectedNumber: 7 }));
    render(<QuestionListPanel />);

    expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', 'question-item-7');
  });
});
