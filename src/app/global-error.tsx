'use client';

import { useEffect } from 'react';

/**
 * The last boundary: an error thrown by the root layout itself.
 *
 * `error.tsx` sits inside the layout, so it cannot catch a failure in the
 * layout that would render it. This replaces the whole document, which is why
 * it carries its own `<html>` and `<body>` — and why it cannot rely on the
 * stylesheet or the brand components: if the layout failed, the thing that
 * imports them is what failed. Everything here is inline and self-contained
 * on purpose.
 *
 * This should essentially never render. It exists so that when it does, the
 * visitor sees a sentence rather than a blank page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global error]', error.digest ?? '(no digest)', error.message);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: '#eef1f6',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          textAlign: 'center',
        }}
      >
        <main>
          <h1 style={{ fontSize: '1.75rem', margin: '0 0 12px', letterSpacing: '-0.015em' }}>
            MockSathi could not start
          </h1>
          <p style={{ margin: '0 0 24px', color: '#51607a', lineHeight: 1.7, maxWidth: '44ch' }}>
            Something failed before the page could be built. Reloading usually clears it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: '44px',
              padding: '0 24px',
              border: '1px solid #1c6ef2',
              borderRadius: '6px',
              background: '#1c6ef2',
              color: '#fff',
              font: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {error.digest ? (
            <p style={{ marginTop: '24px', fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', color: '#67748c' }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
