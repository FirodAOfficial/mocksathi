'use client';

import { useState } from 'react';
import { useShouldRotate } from '@/hooks/useMediaQuery';
import styles from './RotateGate.module.css';

/**
 * Asks a candidate on a phone to turn it, rather than folding the exam away.
 *
 * Both editors are three columns — the question list, the document or sheet,
 * and the candidate summary — and a phone held upright has nowhere near the
 * width for them. The screen does have the pixels; it is holding them the wrong
 * way round. So the paper asks for the rotation instead of hiding the panels
 * behind drawer handles, and the candidate sits the same exam a candidate on a
 * laptop sits.
 *
 * It is a request, not a wall. Orientation can be locked at the operating
 * system level — for a wheelchair-mounted phone, or by someone who reads lying
 * down — and a candidate in that position must still be able to sit the paper.
 * "Continue in portrait" dismisses this for the session and gives them the
 * drawer layout, which is still there underneath.
 */

/** `lock` is not in every browser's `ScreenOrientation`, so it is narrowed here. */
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
};

/**
 * Turns the screen, where the browser allows it.
 *
 * Only Android Chrome and friends can do this, and only from a fullscreen
 * element — iOS Safari has no `lock` at all. Every step is therefore allowed to
 * fail silently: when it does, the prompt stays on screen and the candidate
 * turns the phone by hand, which is what the text asks for in the first place.
 */
async function tryRotate(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    await (screen.orientation as LockableOrientation).lock?.('landscape');
  } catch {
    // No rotation, no error: the written instruction is the fallback.
  }
}

export function RotateGate() {
  const shouldRotate = useShouldRotate();
  const [dismissed, setDismissed] = useState(false);

  if (!shouldRotate || dismissed) return null;

  return (
    <div className={styles.gate} role="dialog" aria-modal="true" aria-labelledby="rotate-gate-heading">
      <div className={styles.card}>
        <PhoneRotateMark />

        <h2 className={styles.heading} id="rotate-gate-heading">
          Turn your phone sideways
        </h2>

        <p className={styles.body}>
          This paper is sat in landscape, so the question list and your progress panel sit beside the
          document — the same screen a candidate on a laptop sees.
        </p>

        <button type="button" className={styles.primary} onClick={tryRotate}>
          Rotate to landscape
        </button>

        <button type="button" className={styles.secondary} onClick={() => setDismissed(true)}>
          Continue in portrait
        </button>

        <p className={styles.note}>
          In portrait the panels open as drawers from the bottom of the screen.
        </p>
      </div>
    </div>
  );
}

/** A phone turning on its side. Decorative — the heading carries the meaning. */
function PhoneRotateMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 96 72" aria-hidden="true" focusable="false">
      <rect x="31" y="6" width="34" height="60" rx="5" className={styles.markPhone} />
      <rect x="37" y="13" width="22" height="42" rx="2" className={styles.markScreen} />
      <path d="M16 46a34 34 0 0 1 10-24" className={styles.markArc} />
      <path d="M11 39l5 8 8-5" className={styles.markArc} />
      <path d="M80 46a34 34 0 0 0-10-24" className={styles.markArc} />
      <path d="M85 39l-5 8-8-5" className={styles.markArc} />
    </svg>
  );
}
