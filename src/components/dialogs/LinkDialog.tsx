'use client';

import { useState, type FormEvent } from 'react';
import type { Editor } from '@tiptap/react';
import { applyLink, normaliseLinkHref, removeLink } from '@/editor/insertActions';
import { Dialog } from './Dialog';
import styles from './LinkDialog.module.css';

export interface LinkDialogProps {
  editor: Editor;
  onClose: () => void;
}

/**
 * Word's Insert Hyperlink.
 *
 * Two fields, as Word has: the text to show and the address. The text field is
 * disabled while a selection exists — the selected words *are* the text, and
 * offering to replace them would quietly rewrite the candidate's document.
 *
 * The address is normalised and checked (`normaliseLinkHref`) before anything
 * is written. A link that cannot be parsed, or that carries a scheme the
 * schema does not allow, is refused here with a message rather than written
 * into the paper as a dead or dangerous href.
 */
export function LinkDialog({ editor, onClose }: LinkDialogProps) {
  const hasSelection = !editor.state.selection.empty;
  const existing = editor.getAttributes('link').href as string | undefined;

  const [href, setHref] = useState(existing ?? '');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent): void => {
    event.preventDefault();

    const normalised = normaliseLinkHref(href);
    if (!normalised) {
      setError('Enter a web address such as example.com, or an email address.');
      return;
    }

    applyLink(editor, normalised, text);
    onClose();
  };

  return (
    <Dialog
      title="Insert Hyperlink"
      onClose={onClose}
      footer={
        <>
          {existing ? (
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                removeLink(editor);
                onClose();
              }}
            >
              Remove Link
            </button>
          ) : null}
          <button type="button" className={styles.button} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="link-dialog-form" className={`${styles.button} ${styles.primary}`}>
            OK
          </button>
        </>
      }
    >
      <form id="link-dialog-form" className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          <span className={styles.caption}>Text to display:</span>
          <input
            className={styles.input}
            value={hasSelection ? '' : text}
            placeholder={hasSelection ? 'The selected text' : 'The address, if left empty'}
            disabled={hasSelection}
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.caption}>Address:</span>
          <input
            className={styles.input}
            value={href}
            autoFocus
            placeholder="example.com"
            onChange={(event) => {
              setHref(event.target.value);
              setError(null);
            }}
          />
        </label>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
