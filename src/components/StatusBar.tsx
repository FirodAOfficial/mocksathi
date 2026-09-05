'use client';

import { useEffect } from 'react';
import { MAX_ZOOM, MIN_ZOOM, useUiStore } from '@/state/uiStore';
import styles from './StatusBar.module.css';

export interface StatusBarProps {
  pages: number;
  words: number;
  readOnly: boolean;
}

export function StatusBar({ pages, words, readOnly }: StatusBarProps) {
  const zoom = useUiStore((state) => state.zoom);
  const setZoom = useUiStore((state) => state.setZoom);
  const stepZoom = useUiStore((state) => state.stepZoom);
  const notice = useUiStore((state) => state.notice);
  const setNotice = useUiStore((state) => state.setNotice);

  useEffect(() => {
    if (!notice) return;
    // Transient messages clear themselves so the bar does not accumulate stale
    // state; a fresh message restarts the timer.
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  return (
    <footer className={styles.bar}>
      <div className={styles.left}>
        {/* Without pagination this is a count, not a position, so it is not
            phrased as "Page 1 of N" — see DocumentCanvas. */}
        <span>
          {pages} {pages === 1 ? 'page' : 'pages'}
        </span>
        <span className={styles.separator} />
        <span>
          {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
        </span>
        {readOnly ? (
          <>
            <span className={styles.separator} />
            <span className={styles.readOnly}>Read-only</span>
          </>
        ) : null}
      </div>

      <div className={styles.notice} role="status">
        {notice}
      </div>

      <div className={styles.zoom}>
        <button type="button" className={styles.zoomButton} onClick={() => stepZoom(-1)} aria-label="Zoom out">
          −
        </button>
        <input
          type="range"
          className={styles.slider}
          min={MIN_ZOOM * 100}
          max={MAX_ZOOM * 100}
          step={5}
          value={Math.round(zoom * 100)}
          aria-label="Zoom level"
          onChange={(event) => setZoom(Number(event.target.value) / 100)}
        />
        <button type="button" className={styles.zoomButton} onClick={() => stepZoom(1)} aria-label="Zoom in">
          +
        </button>
        <span className={styles.percent}>{Math.round(zoom * 100)}%</span>
      </div>
    </footer>
  );
}
