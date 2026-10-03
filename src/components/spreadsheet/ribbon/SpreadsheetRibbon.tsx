'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useWorkbookStore } from '@/spreadsheet/useWorkbook';
import { useSpreadsheetUiStore, type SheetRibbonTabId } from '@/state/spreadsheetUiStore';
import { FormatCellsDialog } from '../FormatCellsDialog';
import { COLLAPSE_ORDER, RibbonCollapseContext } from './CollapsibleGroup';
import { SheetHomeTab } from './SheetHomeTab';
import {
  SheetDataTab,
  SheetFormulasTab,
  SheetInsertTab,
  SheetPageLayoutTab,
  SheetReviewTab,
  SheetViewTab,
} from './SheetSecondaryTabs';
import styles from './SpreadsheetRibbon.module.css';

const TABS: { id: SheetRibbonTabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'pageLayout', label: 'Page Layout' },
  { id: 'formulas', label: 'Formulas' },
  { id: 'data', label: 'Data' },
  { id: 'review', label: 'Review' },
  { id: 'view', label: 'View' },
];

/**
 * Excel's tab strip.
 *
 * Mirrors the Word editor's `Ribbon` deliberately, down to the arrow-key
 * behaviour: the two editors are sat by the same candidates in the same exam,
 * and a ribbon that behaved differently between them would be testing the app
 * rather than the skill.
 */
export function SpreadsheetRibbon() {
  const activeTab = useSpreadsheetUiStore((state) => state.activeTab);
  const setActiveTab = useSpreadsheetUiStore((state) => state.setActiveTab);
  const tablistRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const store = useWorkbookStore();
  const formatCells = useSpreadsheetUiStore((state) => state.formatCells);
  const closeFormatCells = useSpreadsheetUiStore((state) => state.closeFormatCells);
  const setNotice = useSpreadsheetUiStore((state) => state.setNotice);

  /*
   * How many Home groups are folded into single buttons.
   *
   * Found by trying rather than by breakpoints: the ribbon's width depends on
   * the exam panels around it as much as on the window, and the groups' widths
   * on the fonts the browser picked. After each render, if the Home tab still
   * overflows, one more group folds; a change of width starts again from none
   * folded. Layout effects run before paint, so the steps are never seen.
   */
  const [collapse, setCollapse] = useState(0);
  const [measure, setMeasure] = useState(0);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || activeTab !== 'home') return;
    if (panel.scrollWidth > panel.clientWidth + 1 && collapse < COLLAPSE_ORDER.length) setCollapse(collapse + 1);
  }, [activeTab, collapse, measure]);

  /*
   * Re-measured when the ribbon's width changes, and when the tab's contents
   * do — web fonts arriving after the first paint widen every caption, and a
   * measurement taken before them would leave the ribbon overflowing.
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === 'undefined') return;

    let width = panel.clientWidth;
    const observer = new ResizeObserver(() => {
      if (panel.clientWidth !== width) {
        width = panel.clientWidth;
        setCollapse(0);
      }
      setMeasure((value) => value + 1);
    });
    observer.observe(panel);
    if (panel.firstElementChild) observer.observe(panel.firstElementChild);
    return () => observer.disconnect();
  }, [activeTab]);

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (offset === 0) return;

    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.id === activeTab);
    const next = TABS[(index + offset + TABS.length) % TABS.length];
    if (!next) return;

    setActiveTab(next.id);
    tablistRef.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus();
  };

  return (
    <div className={styles.ribbon}>
      <div
        className={styles.tabstrip}
        role="tablist"
        aria-label="Ribbon"
        ref={tablistRef}
        onKeyDown={onTabKeyDown}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab={tab.id}
            id={`sheet-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`sheet-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ''}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        ref={panelRef}
        className={styles.panel}
        role="tabpanel"
        id={`sheet-panel-${activeTab}`}
        aria-labelledby={`sheet-tab-${activeTab}`}
      >
        {activeTab === 'home' ? (
          <RibbonCollapseContext.Provider value={collapse}>
            <SheetHomeTab />
          </RibbonCollapseContext.Provider>
        ) : null}
        {activeTab === 'formulas' ? <SheetFormulasTab /> : null}
        {activeTab === 'view' ? <SheetViewTab /> : null}
        {activeTab === 'insert' ? <SheetInsertTab /> : null}
        {activeTab === 'pageLayout' ? <SheetPageLayoutTab /> : null}
        {activeTab === 'data' ? <SheetDataTab /> : null}
        {activeTab === 'review' ? <SheetReviewTab /> : null}
      </div>

      {/* Here rather than on the Home tab, so Ctrl+1 opens it from any tab. */}
      {formatCells ? (
        <FormatCellsDialog
          store={store}
          initialTab={formatCells}
          onClose={closeFormatCells}
          onNotice={setNotice}
        />
      ) : null}
    </div>
  );
}
