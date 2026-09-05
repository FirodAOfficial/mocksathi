'use client';

import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { findNext, replaceAll, replaceCurrent } from '@/editor/findReplace';
import { Dialog } from './Dialog';
import styles from './FindReplaceDialog.module.css';

export interface FindReplaceDialogProps {
  editor: Editor;
  /** Replace fields are hidden when the dialog was opened from Find. */
  mode: 'find' | 'replace';
  onClose: () => void;
}

export function FindReplaceDialog({ editor, mode, onClose }: FindReplaceDialogProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [status, setStatus] = useState('');

  const options = { matchCase };

  const handleFind = (): void => {
    if (query === '') return;
    setStatus(findNext(editor, query, options) ? '' : `No match for “${query}”.`);
  };

  const handleReplace = (): void => {
    if (query === '') return;
    setStatus(replaceCurrent(editor, query, replacement, options) ? '' : `No match for “${query}”.`);
  };

  const handleReplaceAll = (): void => {
    if (query === '') return;
    const count = replaceAll(editor, query, replacement, options);
    setStatus(count === 0 ? `No match for “${query}”.` : `${count} replacement${count === 1 ? '' : 's'} made.`);
  };

  return (
    <Dialog
      title={mode === 'find' ? 'Find' : 'Find and Replace'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.button} onClick={handleFind}>
            Find Next
          </button>
          {mode === 'replace' ? (
            <>
              <button type="button" className={styles.button} onClick={handleReplace}>
                Replace
              </button>
              <button type="button" className={styles.button} onClick={handleReplaceAll}>
                Replace All
              </button>
            </>
          ) : null}
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className={styles.field}>
        <label htmlFor="find-what">Find what:</label>
        <input
          id="find-what"
          className={styles.input}
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleFind();
            }
          }}
        />
      </div>

      {mode === 'replace' ? (
        <div className={styles.field}>
          <label htmlFor="replace-with">Replace with:</label>
          <input
            id="replace-with"
            className={styles.input}
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
          />
        </div>
      ) : null}

      <label className={styles.checkbox}>
        <input type="checkbox" checked={matchCase} onChange={(event) => setMatchCase(event.target.checked)} />
        Match case
      </label>

      {/* Announced politely so results reach screen readers without stealing focus. */}
      <p className={styles.status} role="status">
        {status}
      </p>
    </Dialog>
  );
}
