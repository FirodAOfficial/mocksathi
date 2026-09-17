'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import styles from './BackToTestsLink.module.css';

export interface BackToTestsLinkProps {
  href: string;
  className: string;
  children: ReactNode;
}

/**
 * "Back to Tests" on the result screen, with an instant full-screen loader
 * for the navigation.
 *
 * A plain `<Link>` here left a candidate looking at the same result with
 * nothing to say a click had registered while `/dashboard/mocks` re-fetched
 * (`publishedTestRows`, `mockLimitStatusForUser`). `router.push` inside
 * `startTransition` keeps `isPending` true for exactly as long as that
 * fetch takes — this overlay covers the whole viewport for that stretch, the
 * same treatment "View Result" already gets on the way in
 * (`dashboard/mocks/test/[id]/submission/loading.tsx`), so a candidate can't
 * click elsewhere mid-navigation either way.
 */
export function BackToTestsLink({ href, className, children }: BackToTestsLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <a
        href={href}
        className={className}
        onClick={(event) => {
          // Left-click, no modifier: intercept it for the transition/overlay.
          // A modified click (open in new tab, etc.) is left to the browser,
          // same guard `next/link` applies internally.
          if (event.defaultPrevented || event.button !== 0) return;
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          startTransition(() => router.push(href));
        }}
      >
        {children}
      </a>
      {isPending && (
        <div className={styles.overlay} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.text}>Loading…</p>
        </div>
      )}
    </>
  );
}
