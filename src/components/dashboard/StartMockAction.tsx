'use client';

import { useState } from 'react';
import { Button, ButtonLink, type ButtonSize } from '../ui/Button';
import { MockLimitModal } from './MockLimitModal';

export interface StartMockActionProps {
  href: string;
  label: string;
  /**
   * Smaller inside a table row, where the action sits beside dense text.
   * Never shorter than 44px — `size` changes the width and the type, not the
   * hit area.
   */
  size?: ButtonSize;
  /** True once starting a *new* mock should be blocked — see `src/dashboard/mockLimit.ts`. */
  limitReached: boolean;
}

/**
 * The one place "starting a new mock" is gated against the free-plan limit.
 *
 * Renders the ordinary link when the candidate is clear to start; renders a
 * same-looking button that opens `MockLimitModal` instead of navigating when
 * they are not — no page flash, no round trip, just the modal. A `Retake` of
 * a paper already sat is never routed through this component (see the
 * callers), so it is never blocked here either.
 */
export function StartMockAction({ href, label, size = 'md', limitReached }: StartMockActionProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!limitReached) {
    return (
      <ButtonLink href={href} size={size}>
        {label}
      </ButtonLink>
    );
  }

  return (
    <>
      <Button size={size} onClick={() => setModalOpen(true)}>
        {label}
      </Button>
      {modalOpen && <MockLimitModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
