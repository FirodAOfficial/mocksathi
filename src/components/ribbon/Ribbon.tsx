'use client';

import { useRef, type KeyboardEvent } from 'react';
import type { Editor } from '@tiptap/react';
import type { ClipboardActions } from '@/editor/useClipboard';
import type { FormatState } from '@/editor/useFormatState';
import { useUiStore, type RibbonTabId } from '@/state/uiStore';
import { HomeTab } from './HomeTab';
import { InsertTab, LayoutTab, ReviewTab, ViewTab } from './SecondaryTabs';
import styles from './Ribbon.module.css';

const TABS: { id: RibbonTabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'layout', label: 'Page Layout' },
  { id: 'review', label: 'Review' },
  { id: 'view', label: 'View' },
];

export interface RibbonProps {
  editor: Editor;
  format: FormatState;
  clipboard: ClipboardActions;
  onFind: () => void;
  onReplace: () => void;
  onWordCount: () => void;
  onOpenFontDialog: () => void;
}

export function Ribbon({
  editor,
  format,
  clipboard,
  onFind,
  onReplace,
  onWordCount,
  onOpenFontDialog,
}: RibbonProps) {
  const activeTab = useUiStore((state) => state.activeTab);
  const setActiveTab = useUiStore((state) => state.setActiveTab);
  const tablistRef = useRef<HTMLDivElement>(null);

  /**
   * Arrow keys move between tabs, which is what the tablist pattern requires —
   * and is not a document editing shortcut, so it does not conflict with the
   * ribbon-only rule.
   */
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
            id={`ribbon-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`ribbon-panel-${tab.id}`}
            // Only the active tab is a tab stop; arrow keys move within the set.
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
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
        id={`ribbon-panel-${activeTab}`}
        aria-labelledby={`ribbon-tab-${activeTab}`}
      >
        {activeTab === 'home' ? (
          <HomeTab
            editor={editor}
            format={format}
            clipboard={clipboard}
            onFind={onFind}
            onReplace={onReplace}
            onOpenFontDialog={onOpenFontDialog}
          />
        ) : null}
        {activeTab === 'insert' ? <InsertTab editor={editor} /> : null}
        {activeTab === 'layout' ? <LayoutTab editor={editor} /> : null}
        {activeTab === 'review' ? <ReviewTab onWordCount={onWordCount} /> : null}
        {activeTab === 'view' ? <ViewTab /> : null}
      </div>
    </div>
  );
}
