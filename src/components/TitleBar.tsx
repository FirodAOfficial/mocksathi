'use client';

import type { Editor } from '@tiptap/react';
import { ToolbarButton } from './controls/ToolbarButton';
import styles from './TitleBar.module.css';

export interface TitleBarProps {
  title: string;
  editor: Editor | null;
  canUndo: boolean;
  canRedo: boolean;
  readOnly: boolean;
}

/**
 * The window caption and Quick Access Toolbar.
 *
 * Undo and Redo live here rather than on the Home tab because that is where
 * Word puts them — and, with keyboard shortcuts suppressed, this is the only
 * place they can be reached from, so they stay visible on every tab.
 */
export function TitleBar({ title, editor, canUndo, canRedo, readOnly }: TitleBarProps) {
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

      {/* Decorative window buttons: this is a web page, so they do nothing and
          are hidden from assistive technology rather than faked as controls. */}
      <div className={styles.windowButtons} aria-hidden="true">
        <span className={styles.windowButton}>—</span>
        <span className={styles.windowButton}>▢</span>
        <span className={`${styles.windowButton} ${styles.closeButton}`}>✕</span>
      </div>
    </header>
  );
}
