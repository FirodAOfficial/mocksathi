'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEditor, type Editor } from '@tiptap/react';
import { UrlDocumentLoader, type DocumentLoader } from '@/services/document/DocumentLoader';
import { DocumentError, toDocumentError } from '@/services/document/errors';
import { createBlankDocument, type DocumentMetadata } from '@/services/document/types';
import { documentToProseMirror } from './documentToProseMirror';
import { buildEditorExtensions } from './extensions';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface DocumentEditorState {
  editor: Editor | null;
  status: LoadStatus;
  error: DocumentError | null;
  metadata: DocumentMetadata;
  /** Re-runs the load; wired to the error overlay's Try again button. */
  retry: () => void;
}

const BLANK_METADATA = createBlankDocument().metadata;

/**
 * Owns the editor instance and the lifecycle of loading a document into it.
 *
 * The component tree only ever sees a status and an editor, which keeps the
 * fetch/parse machinery out of the UI entirely — and means the shell renders
 * the same way whether the document came from a URL or was started blank.
 */
/** The result of one completed load, tagged with what produced it. */
interface LoadOutcome {
  url: string;
  attempt: number;
  status: Exclude<LoadStatus, 'loading'>;
  error: DocumentError | null;
  metadata: DocumentMetadata;
}

export function useDocumentEditor(docUrl: string | null, loader?: DocumentLoader): DocumentEditorState {
  const [outcome, setOutcome] = useState<LoadOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);

  // A default loader would otherwise be rebuilt on every render and restart the effect.
  const documentLoader = useMemo(() => loader ?? new UrlDocumentLoader(), [loader]);

  const editor = useEditor({
    extensions: buildEditorExtensions(),
    content: '',
    // Next renders this tree on the server first; deferring the initial render
    // avoids a hydration mismatch against ProseMirror's generated DOM.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Document body',
      },
    },
  });

  /**
   * Loading state is derived rather than stored.
   *
   * Tagging the outcome with the URL and attempt that produced it means a
   * changed address is *already* "loading" on the render that changes it —
   * there is no window where the previous document's state is shown, and no
   * effect is needed to reset it.
   */
  const view = useMemo((): { status: LoadStatus; error: DocumentError | null; metadata: DocumentMetadata } => {
    if (docUrl === null) return { status: 'ready', error: null, metadata: BLANK_METADATA };
    if (outcome && outcome.url === docUrl && outcome.attempt === attempt) {
      return { status: outcome.status, error: outcome.error, metadata: outcome.metadata };
    }
    return { status: 'loading', error: null, metadata: BLANK_METADATA };
  }, [docUrl, outcome, attempt]);

  useEffect(() => {
    if (!editor) return;

    if (!docUrl) {
      // Pushing content into ProseMirror is synchronising an external system,
      // which is what this effect is for; no React state changes here.
      editor.commands.setContent(documentToProseMirror(createBlankDocument()));
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const model = await documentLoader.load(docUrl, { signal: controller.signal });
        if (cancelled) return;

        editor.commands.setContent(documentToProseMirror(model));
        // The cursor starts at the top of the document, as Word does on open.
        editor.commands.setTextSelection(0);
        setOutcome({ url: docUrl, attempt, status: 'ready', error: null, metadata: model.metadata });
      } catch (caught) {
        if (cancelled) return;
        setOutcome({
          url: docUrl,
          attempt,
          status: 'error',
          error: toDocumentError(caught, 'NETWORK_ERROR'),
          metadata: BLANK_METADATA,
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [docUrl, editor, documentLoader, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { editor, status: view.status, error: view.error, metadata: view.metadata, retry };
}
