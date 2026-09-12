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
            <button
              key={sheet.id}
              type="button"
              role="tab"
              aria-selected={sheet.id === activeId}
              className={`${styles.tab} ${sheet.id === activeId ? styles.tabActive : ''}`}
              onClick={() => store.setActiveSheet(sheet.id)}
              onDoubleClick={() => setRenaming(sheet.id)}
            >
              {sheet.name}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        className={styles.remove}
        title={
          store.workbook.sheetCount > 1
            ? 'Delete the active worksheet'
            : 'Delete Sheet — a workbook must keep at least one sheet'
        }
        aria-label="Delete Sheet"
        disabled={store.workbook.sheetCount <= 1}
        onClick={() => store.removeSheet(activeId)}
      >
        ×
      </button>

      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
