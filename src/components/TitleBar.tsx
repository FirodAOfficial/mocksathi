'use client';

import type { Editor } from '@tiptap/react';
import { ToolbarButton } from './controls/ToolbarButton';
import { CloseSubmitButton } from './exam/CloseSubmitButton';
import styles from './TitleBar.module.css';

export interface TitleBarProps {
  title: string;
  editor: Editor | null;
  canUndo: boolean;
  canRedo: boolean;
  readOnly: boolean;
  /**
   * Stores the open question's answer before submitting. Given only when this
   * editor is being used to sit a paper, and that is what turns ✕ into the
   * submit control; without it the bar shows a decorative ✕, which is all a
   * web page can honestly offer for "close window".
   */
  onSaveAnswer?: () => void;
}

/**
 * The window caption and Quick Access Toolbar.
 *
 * Undo and Redo live here rather than on the Home tab because that is where
 * Word puts them — and, with keyboard shortcuts suppressed, this is the only
 * place they can be reached from, so they stay visible on every tab.
 */
export function TitleBar({ title, editor, canUndo, canRedo, readOnly, onSaveAnswer }: TitleBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.quickAccess} role="toolbar" aria-label="Quick Access Toolbar">
        <ToolbarButton
          label="Undo"
          icon="undo"
          disabled={!editor || !canUndo}
          disabledReason="nothing to undo"
          onClick={() => editor?.chain().focus().undo().run()}
        />
        <ToolbarButton
          label="Redo"
          icon="redo"
          disabled={!editor || !canRedo}
          disabledReason="nothing to redo"
          onClick={() => editor?.chain().focus().redo().run()}
        />
        <ToolbarButton label="Print" icon="print" onClick={() => window.print()} />
      </div>

      <h1 className={styles.title}>
        {title}
        {readOnly ? <span className={styles.badge}>[Read-Only]</span> : null} — Document Editor
      </h1>

      {/*
        Minimise and restore are gone. A web page cannot do either, and three
        buttons where only one works invites the candidate to try the two that
        do not — during a timed paper. What is left is ✕, which during an exam
        submits (`CloseSubmitButton`) and otherwise stays decorative and hidden
        from assistive technology rather than faked as a control.
      */}
      <div className={styles.windowButtons}>
        {onSaveAnswer ? (
          <CloseSubmitButton
            className={`${styles.windowButton} ${styles.closeButton}`}
            onSaveAnswer={onSaveAnswer}
          />
        ) : (
          <span className={`${styles.windowButton} ${styles.closeButton}`} aria-hidden="true">
            ✕
          </span>
        )}
      </div>
    </header>
  );
}
