'use client';

import { useRef, type KeyboardEvent } from 'react';
import { useSpreadsheetUiStore, type SheetRibbonTabId } from '@/state/spreadsheetUiStore';
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
        className={styles.panel}
        role="tabpanel"
        id={`sheet-panel-${activeTab}`}
        aria-labelledby={`sheet-tab-${activeTab}`}
      >
        {activeTab === 'home' ? <SheetHomeTab /> : null}
        {activeTab === 'formulas' ? <SheetFormulasTab /> : null}
        {activeTab === 'view' ? <SheetViewTab /> : null}
        {activeTab === 'insert' ? <SheetInsertTab /> : null}
        {activeTab === 'pageLayout' ? <SheetPageLayoutTab /> : null}
        {activeTab === 'data' ? <SheetDataTab /> : null}
        {activeTab === 'review' ? <SheetReviewTab /> : null}
      </div>
    </div>
  );
}
