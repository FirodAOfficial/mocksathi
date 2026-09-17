'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MockLimitModal } from './MockLimitModal';

export interface StartMockActionProps {
  href: string;
  label: string;
  className: string;
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
export function StartMockAction({ href, label, className, limitReached }: StartMockActionProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!limitReached) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setModalOpen(true)}>
        {label}
      </button>
      {modalOpen && <MockLimitModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
