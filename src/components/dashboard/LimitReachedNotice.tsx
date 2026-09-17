'use client';

import { useState } from 'react';
import { MockLimitModal } from './MockLimitModal';

/**
 * Reopens `MockLimitModal` on load.
 *
 * Mounted only when `/exam` redirected back here because a direct visit
 * tried to start a new mock past the free-plan limit (`?limitReached=1`,
 * `src/app/exam/page.tsx`) — so a candidate who bypasses the in-page
 * `StartMockAction` gate by pasting a URL still lands on the same modal
 * they'd have seen from a click, not a silent redirect.
 */
export function LimitReachedNotice() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return <MockLimitModal onClose={() => setOpen(false)} />;
}
