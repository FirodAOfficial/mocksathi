'use client';

import { useEffect } from 'react';

/**
 * Fires once, on mount, when `clear` is true — finishes clearing an
 * unverified session `signOutIfUnverified` (`src/auth/cookies.ts`) already
 * deleted server-side. That function can't clear the browser's cookie
 * itself (Next.js only allows a cookie write from a Server Action or Route
 * Handler, not a page's own render), so `LoginForm`/`SignupForm` call this
 * to hit the one route that can.
 *
 * Fire-and-forget: the server-side session is already gone by the time this
 * runs, so nothing on the page is waiting on the response.
 */
export function useClearStaleSession(clear: boolean): void {
  useEffect(() => {
    if (clear) void fetch('/api/auth/logout', { method: 'POST' });
  }, [clear]);
}
