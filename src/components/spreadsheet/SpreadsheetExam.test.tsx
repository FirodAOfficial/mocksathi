import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXCEL_SEED_ATTEMPT } from '@/exam/excelSeedAttempt';
import { useExamStore } from '@/state/examStore';
import { useSpreadsheetUiStore } from '@/state/spreadsheetUiStore';
import { SpreadsheetShell } from './SpreadsheetShell';

/**
 * The Excel paper as a candidate sits it.
 *
 * The rule these exist for is the one that makes a paper a paper rather than a
 * scratch sheet: **each question owns its own workbook**. Work on one is kept
 * when you leave it, is not visible from another, and cannot be undone from
 * another.
 */

const VIEWPORT = { width: 1400, height: 800 };

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => VIEWPORT.width,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => VIEWPORT.height,
  });

  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  // The shell asks who is signed in to put a name on the candidate panel.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ user: { name: 'Test Candidate' } }))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  useSpreadsheetUiStore.setState({ activeTab: 'home', zoom: 1, notice: null });
  useExamStore.setState({ answers: {}, submittedBy: null, selectedNumber: 1 });
  cleanup();
});

async function openPaper() {
  render(<SpreadsheetShell exam language="en" />);
  // The attempt is installed in an effect; wait for the first question's data.
  await screen.findByRole('gridcell', { name: 'Student Enrollment Report' });
}

function grid(): HTMLElement {
  return screen.getByRole('grid');
}

/** The question list rows, in order. Named by number and instruction text. */
function questionOption(number: number): HTMLElement {
  const options = within(screen.getByRole('listbox', { name: 'Question list' })).getAllByRole('option');
  const option = options[number - 1];
  if (!option) throw new Error(`no question ${number} in the list`);
  return option;
}

function candidatePanel(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Candidate summary' });
}

/**
 * Types into the cell below the cursor's start.
 *
 * Deliberately not A1: question 1's sheet already has a heading there, and an
 * assertion about "99" appearing would not distinguish a value that was typed
 * from one that was always present.
 */
async function typeIntoCell(text: string): Promise<void> {
  grid().focus();
  await userEvent.keyboard('{ArrowDown}');
  await userEvent.keyboard(text);
}

describe('the Excel paper', () => {
  it('opens with the question list, the candidate panel and the clock', async () => {
    await openPaper();

    expect(screen.getByRole('listbox', { name: 'Question list' })).toBeInTheDocument();
    expect(candidatePanel()).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Test Candidate')).toBeInTheDocument());
  });

  it('shows the first question’s instruction and its starting workbook', async () => {
    await openPaper();

    // Shown above the sheet as well as in the list, so scope to the strip.
    expect(questionOption(1)).toHaveTextContent('merge and center the range A1:D1');
    // The heading the question is about, not a blank sheet.
    expect(screen.getByRole('gridcell', { name: 'Student Enrollment Report' })).toBeInTheDocument();
  });

  it('keeps each question’s work separate', async () => {
    // The load-bearing behaviour: switching questions must not carry work
    // across, and coming back must find it exactly as it was left.
    await openPaper();
    await typeIntoCell('99{Enter}');
    expect(await screen.findByRole('gridcell', { name: '99' })).toBeInTheDocument();

    await userEvent.click(questionOption(2));
    await waitFor(() => expect(screen.queryByRole('gridcell', { name: '99' })).not.toBeInTheDocument());

    await userEvent.click(questionOption(1));
    expect(await screen.findByRole('gridcell', { name: '99' })).toBeInTheDocument();
  });

  it('cannot undo one question’s work from another', async () => {
    // The spreadsheet version of the bug `useQuestionAnswers.install` avoids:
    // a shared history would let Undo on question 2 edit question 1.
    await openPaper();
    await typeIntoCell('99{Enter}');

    await userEvent.click(questionOption(2));

    expect(screen.getByRole('button', { name: /^Undo/ })).toBeDisabled();
  });

  it('marks a question attempted only once its workbook changes', async () => {
    await openPaper();
    // Visiting is not attempting: opening a question and leaving it alone must
    // not count, which is what makes the palette agree with the sheet.
    await userEvent.click(questionOption(2));
    await userEvent.click(questionOption(1));
    expect(Object.keys(useExamStore.getState().answers)).toEqual([]);

    await typeIntoCell('99{Enter}');
    await userEvent.click(questionOption(2));

    await waitFor(() => expect(Object.keys(useExamStore.getState().answers)).toEqual(['1']));
    expect(within(questionOption(1)).getByLabelText('edited')).toBeInTheDocument();
  });

  it('restores the starting workbook when the answer is cleared', async () => {
    await openPaper();
    await typeIntoCell('99{Enter}');

    // Clear stays disabled until the answer has been banked, which happens on
    // leaving the question. The Word paper behaves the same way, and the two
    // must not diverge — the same candidates sit both.
    await userEvent.click(questionOption(2));
    await userEvent.click(questionOption(1));
    expect(await screen.findByRole('gridcell', { name: '99' })).toBeInTheDocument();

    await userEvent.click(within(candidatePanel()).getByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(screen.queryByRole('gridcell', { name: '99' })).not.toBeInTheDocument());
    expect(screen.getByRole('gridcell', { name: 'Student Enrollment Report' })).toBeInTheDocument();
    expect(useExamStore.getState().answers[1]).toBeUndefined();
  });

  it('runs a paper of fifteen questions', async () => {
    await openPaper();

    expect(useExamStore.getState().attempt.subject).toBe('excel');
    expect(EXCEL_SEED_ATTEMPT.sections[0]?.questions).toHaveLength(15);
  });

  it('is a plain spreadsheet when it is not an exam', () => {
    render(<SpreadsheetShell />);

    expect(screen.queryByRole('listbox', { name: 'Question list' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Candidate summary' })).not.toBeInTheDocument();
  });
});
