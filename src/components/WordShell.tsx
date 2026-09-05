'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useClipboard } from '@/editor/useClipboard';
import { useDocumentEditor } from '@/editor/useDocumentEditor';
import { useFormatState } from '@/editor/useFormatState';
import { useQuestionAnswers } from '@/editor/useQuestionAnswers';
import { answeredSet, selectIsLocked, useExamStore } from '@/state/examStore';
import type { DocumentMetadata } from '@/services/document/types';
import { useUiStore } from '@/state/uiStore';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';
import { Dialog } from './dialogs/Dialog';
import { FindReplaceDialog } from './dialogs/FindReplaceDialog';
import { WordCountDialog } from './dialogs/WordCountDialog';
import { DocumentCanvas } from './document/DocumentCanvas';
import { ExamSummaryPanel } from './exam/ExamSummaryPanel';
import { QuestionListPanel } from './exam/QuestionListPanel';
import { DocumentErrorOverlay, LoadingOverlay, UnsupportedNotice } from './document/DocumentOverlays';
import { ResultDialog } from './exam/ResultDialog';
import { Ribbon } from './ribbon/Ribbon';
import styles from './WordShell.module.css';

export interface WordShellProps {
  /** The `docUrl` query parameter, or null for a blank document. */
  docUrl: string | null;
}

type OpenDialog = 'find' | 'replace' | 'wordCount' | null;

/**
 * Composition root for the application.
 *
 * It wires the loader, the editor and the chrome together and owns nothing but
 * the small amount of state that genuinely spans them — which dialog is open,
 * the page estimate, and whether the formatting notice has been dismissed.
 */
export function WordShell({ docUrl }: WordShellProps) {
  const { editor, status, error, metadata, retry } = useDocumentEditor(docUrl);
  const format = useFormatState(editor);
  const clipboard = useClipboard(editor);

  const readOnly = useUiStore((state) => state.readOnly);
  const locked = useExamStore(selectIsLocked);
  const submittedBy = useExamStore((state) => state.submittedBy);
  const resultSeen = useExamStore((state) => state.resultSeen);
  const dismissResult = useExamStore((state) => state.dismissResult);
  const attempt = useExamStore((state) => state.attempt);
  const answers = useExamStore((state) => state.answers);

  // Each question owns its own document; this keeps the editor in step with the
  // question selected in the side panels.
  const questionAnswers = useQuestionAnswers(editor, {
    enabled: status === 'ready',
    adoptInitialContent: docUrl !== null,
  });

  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [pages, setPages] = useState(1);
  /**
   * Which document's notice was dismissed, rather than a plain boolean: a newly
   * loaded document has its own set of unsupported features, and recording the
   * metadata identity re-shows the strip without needing an effect to reset it.
   */
  const [dismissedFor, setDismissedFor] = useState<DocumentMetadata | null>(null);
  const noticeDismissed = dismissedFor === metadata;

  // The paper closes when the countdown ends or the candidate submits; either
  // way the document stops accepting edits.
  useEffect(() => {
    editor?.setEditable(!readOnly && !locked);
  }, [editor, readOnly, locked]);

  const paragraphs = useMemo(() => {
    if (!editor || dialog !== 'wordCount') return 0;
    let count = 0;
    editor.state.doc.descendants((node) => {
      if (node.isTextblock) count += 1;
      return true;
    });
    return count;
  }, [editor, dialog]);

  const handlePageCount = useCallback((value: number) => setPages(value), []);

  return (
    <div className={styles.shell}>
      <TitleBar
        title={metadata.title}
        editor={editor}
        canUndo={format.canUndo}
        canRedo={format.canRedo}
        readOnly={readOnly}
      />

      {editor ? (
        <Ribbon
          editor={editor}
          format={format}
          clipboard={clipboard}
          onFind={() => setDialog('find')}
          onReplace={() => setDialog('replace')}
          onWordCount={() => setDialog('wordCount')}
        />
      ) : (
        // Reserves the ribbon's height so the chrome does not jump once the
        // editor finishes mounting.
        <div className={styles.ribbonPlaceholder} aria-hidden="true" />
      )}

      {!noticeDismissed ? (
        <UnsupportedNotice features={metadata.unsupportedFeatures} onDismiss={() => setDismissedFor(metadata)} />
      ) : null}

      {locked ? (
        <div className={styles.lockedBanner} role="status">
          {submittedBy === 'timeout'
            ? 'Time is up. Your work was submitted automatically and the document can no longer be edited.'
            : 'Paper submitted. The document can no longer be edited.'}
        </div>
      ) : null}

      {/*
        Three columns: the question list, the document being written into, and
        the candidate summary. Only the middle one holds the editor, so the
        panels can be removed without the editor knowing they existed.
      */}
      <div className={styles.workspace}>
        <QuestionListPanel />

        <main className={styles.main}>
          {editor ? <DocumentCanvas editor={editor} onPageCountChange={handlePageCount} /> : null}

          {status === 'loading' && docUrl ? <LoadingOverlay url={docUrl} /> : null}
          {status === 'error' && error ? <DocumentErrorOverlay error={error} onRetry={retry} /> : null}
        </main>

        <ExamSummaryPanel onClearAnswer={questionAnswers.clearCurrent} onSaveAnswer={questionAnswers.saveCurrent} />
      </div>

      <StatusBar pages={pages} words={format.words} readOnly={readOnly || locked} />

      {editor && (dialog === 'find' || dialog === 'replace') ? (
        <FindReplaceDialog editor={editor} mode={dialog} onClose={() => setDialog(null)} />
      ) : null}

      {/* The result screen opens itself as soon as the paper closes, however
          that happened, and stays dismissed once acknowledged. */}
      {submittedBy && !resultSeen ? (
        <ResultDialog
          attempt={attempt}
          answered={answeredSet(answers)}
          reason={submittedBy}
          onClose={dismissResult}
        />
      ) : null}

      {editor && dialog === 'wordCount' ? (
        <WordCountDialog
          words={format.words}
          characters={format.characters}
          paragraphs={paragraphs}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

/** Re-exported so the dialog primitive has a single import path for consumers. */
export { Dialog };
