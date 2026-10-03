'use client';

import { useState } from 'react';
import { useWorkbookStore, useWorkbookVersion } from '@/spreadsheet/useWorkbook';
import styles from './SheetTabs.module.css';

/**
 * The sheet tab strip.
 *
 * Renaming happens in place, as it does in Excel: double-click a tab and it
 * becomes an input. The rename is refused rather than corrected when the name
 * breaks Excel's rules — 1-31 characters, no `: \ / ? * [ ]`, unique — because
 * silently altering what someone typed is worse than telling them no.
 */
export function SheetTabs() {
  const store = useWorkbookStore();
  useWorkbookVersion();

  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sheets = store.workbook.visibleSheets();
  const activeId = store.workbook.activeSheetId;
  // Visible sheets, not all of them: deleting the last visible sheet would
  // leave a strip of only hidden ones and nothing to show.
  const canDelete = sheets.length > 1;

  const finishRename = (sheetId: string, name: string): void => {
    const trimmed = name.trim();
    setRenaming(null);

    if (trimmed.length === 0 || trimmed === store.workbook.sheetById(sheetId)?.name) return;

    if (!store.renameSheet(sheetId, trimmed)) {
      setError(`"${trimmed}" is not a usable sheet name.`);
      return;
    }
    setError(null);
  };

  return (
    <div className={styles.strip}>
      <button
        type="button"
        className={styles.add}
        title="Insert a new worksheet"
        aria-label="Insert Worksheet"
        onClick={() => store.addSheet()}
      >
        +
      </button>

      <div className={styles.tabs} role="tablist" aria-label="Worksheets">
        {sheets.map((sheet) =>
          renaming === sheet.id ? (
            <input
              key={sheet.id}
              className={styles.rename}
              defaultValue={sheet.name}
              aria-label={`Rename ${sheet.name}`}
              autoFocus
              onBlur={(event) => finishRename(sheet.id, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') finishRename(sheet.id, event.currentTarget.value);
                if (event.key === 'Escape') setRenaming(null);
              }}
            />
          ) : (
            // A wrapper, not one button: the close button cannot sit inside
            // the tab button, since a button may not contain another.
            <div
              key={sheet.id}
              className={`${styles.tab} ${sheet.id === activeId ? styles.tabActive : ''}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={sheet.id === activeId}
                className={styles.tabLabel}
                onClick={() => store.setActiveSheet(sheet.id)}
                onDoubleClick={() => setRenaming(sheet.id)}
              >
                {sheet.name}
              </button>
              {/*
                Each tab carries its own ×, so the sheet that goes is the one
                clicked — not whichever happened to be active. Absent on the
                last visible sheet: a workbook must keep one.
              */}
              {canDelete ? (
                <button
                  type="button"
                  className={styles.close}
                  title={`Delete ${sheet.name}`}
                  aria-label={`Delete ${sheet.name}`}
                  onClick={() => store.removeSheet(sheet.id)}
                >
                  ×
                </button>
              ) : null}
            </div>
          ),
        )}
      </div>

      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
