import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Field } from './Field';
import { Badge, EmptyState, Skeleton, SkeletonText } from './Surfaces';
import { Toast } from './Toast';

/*
 * The primitives exist to stop thirty-three components each deciding these
 * things differently. What is pinned here is the handful of decisions that are
 * easy to get wrong quietly — not how anything looks.
 */

afterEach(cleanup);

describe('Button', () => {
  /*
   * A disabled button loses focus, which throws a keyboard user back to the
   * top of the form at the moment they are waiting for an answer — and stops
   * the busy state being announced at all.
   */
  it('stays focusable while loading, and says it is busy', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });

    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  /* The label stays beside the spinner: a button that changes width mid-submit
     moves the thing the user just clicked. */
  it('keeps its label while loading', () => {
    render(<Button loading>Submit paper</Button>);
    expect(screen.getByRole('button', { name: 'Submit paper' })).toBeInTheDocument();
  });

  it('does not submit a form unless asked to', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('type', 'button');
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Delete
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  /*
   * Every form wired this by hand, so the wiring differed and none of them
   * connected the error text to the control.
   */
  it('ties the label, the help and the error to the input', () => {
    render(<Field label="Email" help="We never share it." error="Enter a valid address." />);

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ')).toHaveLength(2);
    expect(screen.getByText('We never share it.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid address.');
  });

  it('is not marked invalid without an error', () => {
    render(<Field label="Name" />);
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
  });

  /* A live region has to be in the document before the text arrives, or the
     browser has no change to announce. */
  it('keeps the error region mounted while empty', () => {
    const { container } = render(<Field label="Name" />);
    expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
  });

  it('marks what is optional rather than what is required', () => {
    render(<Field label="Target exam" optional />);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });
});

describe('Badge', () => {
  /* Colour never carries the meaning on its own — the word inside does. */
  it('always has a readable label', () => {
    render(<Badge tone="danger">Failed</Badge>);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  /* One skeleton is decoration; the group announces once. Otherwise a screen
     reader hears "loading" once per placeholder line. */
  it('hides a lone placeholder from assistive technology', () => {
    const { container } = render(<Skeleton width={120} height={12} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('announces the group once, not once per line', () => {
    render(<SkeletonText lines={4} />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('EmptyState', () => {
  it('offers a way forward when one is given', () => {
    render(
      <EmptyState
        title="No mocks yet"
        body="Your results appear here once you have sat one."
        action={<Button>Start a mock</Button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Start a mock' })).toBeInTheDocument();
  });
});

describe('Toast', () => {
  /*
   * Someone who looked away for the four seconds a success message needs has
   * not been told what went wrong.
   */
  it('dismisses a success on its own but keeps an error', () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      const { rerender } = render(<Toast message="Saved" tone="success" onDismiss={onDismiss} />);
      vi.advanceTimersByTime(5000);
      expect(onDismiss).toHaveBeenCalled();

      onDismiss.mockClear();
      rerender(<Toast message="Could not save" tone="error" onDismiss={onDismiss} />);
      vi.advanceTimersByTime(60_000);
      expect(onDismiss).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
