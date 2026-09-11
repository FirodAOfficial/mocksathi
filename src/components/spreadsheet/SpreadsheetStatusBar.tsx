'use client';

import { useEffect } from 'react';
import { useSelection, useWorkbookStore, useWorkbookVersion } from '@/spreadsheet/useWorkbook';
import {
  MAX_SHEET_ZOOM,
  MIN_SHEET_ZOOM,
  useSpreadsheetUiStore,
} from '@/state/spreadsheetUiStore';
import styles from './SpreadsheetStatusBar.module.css';

/** Beyond this many selected cells the aggregates are not computed. */
const MAX_AGGREGATE_CELLS = 200_000;

/**
 * Excel's status bar: Average, Count and Sum of the selection, plus zoom.
 *
 * The aggregates are what make a spreadsheet feel like one — selecting a column
 * and reading its total without writing a formula. They are computed over the
 * selection each render, which is why the cap exists: selecting whole columns
 * is one click, and a million-cell walk on every arrow key would be felt.
 */
export function SpreadsheetStatusBar() {
  const store = useWorkbookStore();
  const selection = useSelection();
  useWorkbookVersion();

  const zoom = useSpreadsheetUiStore((state) => state.zoom);
  const setZoom = useSpreadsheetUiStore((state) => state.setZoom);
  const stepZoom = useSpreadsheetUiStore((state) => state.stepZoom);
  const notice = useSpreadsheetUiStore((state) => state.notice);
  const readOnly = useSpreadsheetUiStore((state) => state.readOnly);
  const setNotice = useSpreadsheetUiStore((state) => state.setNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  const sheet = store.activeSheet();
  const calc = store.getCalcState();

  let count = 0;
  let numeric = 0;
  let sum = 0;
  let walked = 0;
  let capped = false;

  for (const { row, col } of store.selection.addresses()) {
    walked += 1;
    if (walked > MAX_AGGREGATE_CELLS) {
      capped = true;
      break;
    }

    const value = sheet.getValue(row, col);
    if (value === null) continue;

    count += 1;
    if (typeof value === 'number') {
      numeric += 1;
      sum += value;
    }
  }

  const multiple = selection.ranges.some(
    (range) => range.start.row !== range.end.row || range.start.col !== range.end.col,
  );

  return (
    <footer className={styles.bar}>
      <div className={styles.left}>
        <span>{readOnly ? 'Protected' : 'Ready'}</span>
        {calc === 'loading' ? <span className={styles.calc}>Loading calculation engine…</span> : null}
        {calc === 'calculating' ? <span className={styles.calc}>Calculating…</span> : null}
        {calc === 'unavailable' ? (
          <span className={styles.warning}>
            Calculation unavailable — formulas keep their text but are not evaluated
          </span>
        ) : null}
      </div>

      <div className={styles.notice} role="status">
        {notice}
      </div>

      <div className={styles.stats}>
        {capped ? (
          <span title="Too many cells selected to total quickly">Selection too large to total</span>
        ) : multiple && count > 0 ? (
          <>
            {numeric > 0 ? <span>Average: {trim(sum / numeric)}</span> : null}
            <span>Count: {count}</span>
            {numeric > 0 ? <span>Sum: {trim(sum)}</span> : null}
          </>
        ) : null}
      </div>

      <div className={styles.zoom}>
        <button type="button" className={styles.zoomButton} onClick={() => stepZoom(-1)} aria-label="Zoom out">
          −
        </button>
        <input
          type="range"
          className={styles.slider}
          min={MIN_SHEET_ZOOM * 100}
          max={MAX_SHEET_ZOOM * 100}
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

/** Nine significant digits, so a sum does not show floating-point noise. */
function trim(value: number): string {
  return String(Number(value.toPrecision(9)));
}
