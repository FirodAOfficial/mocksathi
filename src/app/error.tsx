'use client';

import { useEffect } from 'react';
import { ErrorPage } from '@/components/site/ErrorPage';
import styles from '@/components/site/ErrorPage.module.css';

/**
 * The route error boundary.
 *
 * Must be a client component — React needs `reset` to re-render the segment on
 * the client — which is why it cannot ask who is signed in the way
 * `not-found.tsx` does. It offers the retry instead, which is the action that
 * actually helps: most of what lands here is a request that failed once.
 *
 * `error.message` is deliberately not shown. In production React replaces it
 * with a generic string anyway, and on a page a stranger can reach, an
 * exception's text says more to someone probing the app than to the person
 * trying to read it. The digest is an opaque id for the same failure, which is
 * what makes a support message actionable.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server logs its own failures; this is the client half, and the only
    // record that a boundary caught anything at all.
    console.error('[route error]', error.digest ?? '(no digest)', error.message);
  }, [error]);

  return (
    <ErrorPage
      code="Something went wrong"
      title="That did not load"
      message="The page failed while it was being prepared. Trying again usually works; if it does not, the reference below will tell us what happened."
      action={{ href: '/dashboard', label: 'Go to Dashboard' }}
      secondary={
        <button type="button" className={styles.secondary} onClick={reset}>
          Try Again
        </button>
      }
      digest={error.digest}
    />
  );
}
