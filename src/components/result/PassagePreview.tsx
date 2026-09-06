'use client';

import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { buildEditorExtensions } from '@/editor/extensions';
import styles from './PassagePreview.module.css';

export interface PassagePreviewProps {
  document: JSONContent;
  className?: string;
}

/**
 * A read-only render of an answer document.
 *
 * It mounts the real editor rather than mapping the JSON to HTML by hand. The
 * schema already knows how every mark and paragraph attribute renders, and a
 * second mapping would be a second thing to keep in step — the review screen
 * would start showing formatting the editor never produced, or miss formatting
 * it did. Not editable, so it is a viewer that happens to share the schema.
 */
export function PassagePreview({ document, className }: PassagePreviewProps) {
  const editor = useEditor(
    {
      editable: false,
      content: document,
      extensions: buildEditorExtensions(),
      immediatelyRender: false,
    },
    [document],
  );

  if (!editor) return null;

  return <EditorContent editor={editor} className={`${styles.preview} ${className ?? ''}`} />;
}
