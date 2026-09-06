'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useClipboard } from '@/editor/useClipboard';
import { useDocumentEditor } from '@/editor/useDocumentEditor';
import { useFormatState } from '@/editor/useFormatState';
import { useQuestionAnswers } from '@/editor/useQuestionAnswers';
import type { ExamResult } from '@/exam/result';
import { SubmissionError, submitAttempt } from '@/exam/submitAttempt';
import { elapsedSeconds, selectIsLocked, useExamStore } from '@/state/examStore';
import type { DocumentMetadata } from '@/services/document/types';
import type { Language } from '@/exam/types';
import { useUiStore } from '@/state/uiStore';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';
import { Dialog } from './dialogs/Dialog';
import { FindReplaceDialog } from './dialogs/FindReplaceDialog';
import { FontDialog } from './dialogs/FontDialog';
import { WordCountDialog } from './dialogs/WordCountDialog';
import { DocumentCanvas } from './document/DocumentCanvas';
import { ExamSummaryPanel } from './exam/ExamSummaryPanel';
import { QuestionListPanel } from './exam/QuestionListPanel';
import { DocumentErrorOverlay, LoadingOverlay, UnsupportedNotice } from './document/DocumentOverlays';
import { InstructionStrip } from './exam/InstructionStrip';
import { ResultView } from './result/ResultView';
import { Ribbon } from './ribbon/Ribbon';
import styles from './WordShell.module.css';

export interface WordShellProps {
  /** The `docUrl` query parameter, or null for a blank document. */
  docUrl: string | null;
  /**
   * Whether this is an exam sitting.
   *
   * False gives a plain word processor: no question panels, no instruction, no
   * timer and no submit. That is what "start a blank document" means, and what
   * opening a `.docx` from a URL gives.
   */
  exam?: boolean;
  /** The language the paper is sat in. Ignored outside an exam. */
  language?: Language;
}

type OpenDialog = 'find' | 'replace' | 'wordCount' | 'font' | null;

/**
 * Composition root for the application.
 *
 * It wires the loader, the editor and the chrome together and owns nothing but
 * the small amount of state that genuinely spans them — which dialog is open,
 * the page estimate, and whether the formatting notice has been dismissed.
 */
export function WordShell({ docUrl, exam = false, language: examLanguage = 'en' }: WordShellProps) {
  const { editor, status, error, metadata, retry } = useDocumentEditor(docUrl);
  const format = useFormatState(editor);
  const clipboard = useClipboard(editor);

  const readOnly = useUiStore((state) => state.readOnly);
  const focusMode = useUiStore((state) => state.focusMode);
  const locked = useExamStore(selectIsLocked);
  const submittedBy = useExamStore((state) => state.submittedBy);
  const answers = useExamStore((state) => state.answers);
  const attempt = useExamStore((state) => state.attempt);
  const startedAt = useExamStore((state) => state.startedAt);
  const startAttempt = useExamStore((state) => state.startAttempt);
  const timePerQuestion = useExamStore((state) => state.timePerQuestion);
  const language = useExamStore((state) => state.language);

  /** The marked result, once the server has returned it. */
  const [result, setResult] = useState<ExamResult | null>(null);
  const [markingError, setMarkingError] = useState<string | null>(null);

  // Each question owns its own document; this keeps the editor in step with the
  // question selected in the side panels.
  const questionAnswers = useQuestionAnswers(editor, {
    enabled: exam && status === 'ready',
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

  /*
   * Opening the exam shell starts a sitting: the clock runs from here, and the
   * language chosen on the instructions page is carried in.
   *
   * It also clears whatever the last paper left behind. The exam store is a
   * module singleton, so walking from a result screen back to the instructions
   * and starting again is a client-side navigation that never resets it — and
   * a stale `submittedBy` would put the candidate back on the result screen
   * instead of a blank paper.
   */
  useEffect(() => {
    if (exam) startAttempt(examLanguage);
  }, [exam, startAttempt, examLanguage]);

  /*
   * Marking happens on the server, so closing the paper starts a request rather
   * than computing a result here. Sending only the answers keeps the marking
   * scheme — and the marks — out of reach of the browser.
   */
  useEffect(() => {
    if (!submittedBy) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const marked = await submitAttempt(
          {
            answers,
            language,
            timePerQuestion,
            totalTimeSeconds: elapsedSeconds(startedAt),
          },
          controller.signal,
        );
        setResult(marked);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setMarkingError(
          error instanceof SubmissionError ? error.message : 'Your paper could not be marked.',
        );
      }
    })();

    return () => controller.abort();
    // `answers` and the timings are frozen the moment the paper closes, so this
    // deliberately runs once per submission rather than on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedBy]);

  /*
   * Once the paper closes it is replaced by the result screen rather than being
   * shown locked behind a dialog. The result is where the candidate goes next —
   * back to the tests, or into another attempt — so the editor has no further
   * part to play.
   */
  if (exam && submittedBy) {
    if (result) return <ResultView result={result} attempt={attempt} answers={answers} language={language} backHref="/" />;

    return (
      <div className={styles.marking} role="status" aria-live="polite">
        {markingError ? (
          <>
            <p className={styles.markingTitle}>Your paper could not be marked</p>
            <p className={styles.markingDetail}>{markingError}</p>
          </>
        ) : (
          <>
            <span className={styles.markingSpinner} aria-hidden="true" />
            <p className={styles.markingTitle}>Marking your paper…</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <TitleBar
        title={metadata.title}
        editor={editor}
        canUndo={format.canUndo}
        canRedo={format.canRedo}
        readOnly={readOnly}
      />

      {editor && !focusMode ? (
        <Ribbon
          editor={editor}
          format={format}
          clipboard={clipboard}
          onFind={() => setDialog('find')}
          onReplace={() => setDialog('replace')}
          onWordCount={() => setDialog('wordCount')}
          onOpenFontDialog={() => setDialog('font')}
        />
      ) : focusMode ? (
        // Focus hides the ribbon outright rather than reserving its height —
        // the point of the mode is to give the space back to the document.
        <FocusExit />
      ) : (
        // Reserves the ribbon's height so the chrome does not jump once the
        // editor finishes mounting.
        <div className={styles.ribbonPlaceholder} aria-hidden="true" />
      )}

      {!noticeDismissed ? (
        <UnsupportedNotice features={metadata.unsupportedFeatures} onDismiss={() => setDismissedFor(metadata)} />
      ) : null}

      {/*
        Three columns: the question list, the document being written into, and
        the candidate summary. Only the middle one holds the editor, so the
        panels can be removed without the editor knowing they existed.
      */}
      <div className={styles.workspace}>
        {exam && !focusMode ? <QuestionListPanel /> : null}

        <main className={styles.main}>
          {exam ? <InstructionStrip /> : null}

          {editor ? <DocumentCanvas editor={editor} onPageCountChange={handlePageCount} /> : null}

          {status === 'loading' && docUrl ? <LoadingOverlay url={docUrl} /> : null}
          {status === 'error' && error ? <DocumentErrorOverlay error={error} onRetry={retry} /> : null}
        </main>

        {exam && !focusMode ? (
          <ExamSummaryPanel
            onClearAnswer={questionAnswers.clearCurrent}
            onSaveAnswer={questionAnswers.saveCurrent}
          />
        ) : null}
      </div>

      <StatusBar pages={pages} words={format.words} readOnly={readOnly || locked} />

      {editor && (dialog === 'find' || dialog === 'replace') ? (
        <FindReplaceDialog editor={editor} mode={dialog} onClose={() => setDialog(null)} />
      ) : null}

      {editor && dialog === 'font' ? <FontDialog editor={editor} onClose={() => setDialog(null)} /> : null}

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

/**
 * The way back out of Focus.
 *
 * Focus removes the ribbon, so the button that turns it off has to survive it —
 * otherwise the mode is a trap for anyone who cannot use the View tab to leave
 * because the View tab is gone.
 */
function FocusExit() {
  const toggleFocusMode = useUiStore((state) => state.toggleFocusMode);

  return (
    <div className={styles.focusBar}>
      <button type="button" className={styles.focusExit} onClick={toggleFocusMode}>
        Exit Focus
      </button>
    </div>
  );
}

/** Re-exported so the dialog primitive has a single import path for consumers. */
export { Dialog };
