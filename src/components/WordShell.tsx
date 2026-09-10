'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDrawerLayout } from '@/hooks/useMediaQuery';
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
  const setAttempt = useExamStore((state) => state.setAttempt);
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

  /*
   * Below 768px the three columns cannot coexist: the page alone is wider than
   * the viewport. The side panels become drawers over the document instead, and
   * only one is open at a time.
   */
  const isMobile = useDrawerLayout();
  const [drawer, setDrawer] = useState<'questions' | 'summary' | null>(null);
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
   * Derived rather than reset in an effect: on a wide screen both panels are
   * already columns on the page, so there is no such thing as an open drawer.
   * Widening the window therefore cannot leave one floating over the layout,
   * and nothing has to notice the change to put it away.
   */
  const openDrawer = isMobile ? drawer : null;

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
   * The panel shows "Candidate" (the `SEED_ATTEMPT` fixture's default) until
   * this resolves. Fetched, not passed as a prop: the exam store is a client
   * module singleton with no server-rendered page feeding it, and `/exam`
   * itself stays open to a signed-out visitor sitting the sample paper —
   * this only replaces the name when someone actually is signed in.
   */
  useEffect(() => {
    if (!exam) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/auth/me', { signal: controller.signal });
        if (!response.ok) return;
        const body = (await response.json()) as { user: { name: string } | null };
        if (body.user) setAttempt({ ...useExamStore.getState().attempt, candidateName: body.user.name });
      } catch {
        // Signed out, offline, or the request was aborted — the fixture's name stands.
      }
    })();

    return () => controller.abort();
  }, [exam, setAttempt]);

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
        {exam && !focusMode ? (
          <Panel side="left" open={openDrawer === 'questions'} isMobile={isMobile} onClose={() => setDrawer(null)}>
            <QuestionListPanel />
          </Panel>
        ) : null}

        <main className={styles.main}>
          {exam ? <InstructionStrip /> : null}

          {editor ? <DocumentCanvas editor={editor} onPageCountChange={handlePageCount} /> : null}

          {status === 'loading' && docUrl ? <LoadingOverlay url={docUrl} /> : null}
          {status === 'error' && error ? <DocumentErrorOverlay error={error} onRetry={retry} /> : null}
        </main>

        {exam && !focusMode ? (
          <Panel side="right" open={openDrawer === 'summary'} isMobile={isMobile} onClose={() => setDrawer(null)}>
            <ExamSummaryPanel
              onClearAnswer={questionAnswers.clearCurrent}
              onSaveAnswer={questionAnswers.saveCurrent}
            />
          </Panel>
        ) : null}
      </div>

      {/*
        The drawer handles, at the bottom of the screen where a thumb reaches.
        Only rendered on the layout that has drawers — on a wide screen both
        panels are already on the page and a button to open them would be a lie.
      */}
      {exam && !focusMode && isMobile ? (
        <nav className={styles.drawerBar} aria-label="Exam panels">
          <button
            type="button"
            className={styles.drawerTab}
            aria-expanded={openDrawer === 'questions'}
            onClick={() => setDrawer((open) => (open === 'questions' ? null : 'questions'))}
          >
            Questions
          </button>
          <button
            type="button"
            className={styles.drawerTab}
            aria-expanded={openDrawer === 'summary'}
            onClick={() => setDrawer((open) => (open === 'summary' ? null : 'summary'))}
          >
            Progress &amp; Submit
          </button>
        </nav>
      ) : null}

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
 * A side panel: a column on a wide screen, a drawer on a narrow one.
 *
 * On mobile the panel is only mounted while it is open. That is deliberate
 * rather than hiding it with CSS: a closed drawer left in the DOM keeps its
 * buttons in the tab order and its headings in the screen-reader outline, so a
 * keyboard user would tab into a panel nobody can see.
 */
function Panel({
  side,
  open,
  isMobile,
  onClose,
  children,
}: {
  side: 'left' | 'right';
  open: boolean;
  isMobile: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);

  /*
   * Escape closes it, and focus goes in and comes back out.
   *
   * The focus half is not a nicety. `aria-modal="true"` tells assistive
   * technology the rest of the page is not there; leaving focus on the button
   * behind the drawer would strand a screen-reader or keyboard user on an
   * element their software has just been told to ignore. Tab is kept inside
   * for the same reason, and the trigger gets focus back on close so the way
   * out lands where the way in started.
   */
  useEffect(() => {
    if (!isMobile || !open) return;

    const drawer = drawerRef.current;
    const returnTo = document.activeElement as HTMLElement | null;

    const focusable = (): HTMLElement[] =>
      [
        ...(drawer?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? []),
      ].filter((element) => element.offsetParent !== null);

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;

      // Wrap at both ends rather than letting Tab walk out into the page.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      returnTo?.focus();
    };
  }, [isMobile, open, onClose]);

  if (!isMobile) return <div className={styles.column}>{children}</div>;
  if (!open) return null;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={drawerRef}
        className={`${styles.drawer} ${side === 'left' ? styles.drawerLeft : styles.drawerRight}`}
        role="dialog"
        aria-modal="true"
        aria-label={side === 'left' ? 'Questions' : 'Progress and submit'}
      >
        <button type="button" className={styles.drawerClose} onClick={onClose}>
          Close
        </button>
        <div className={styles.drawerBody}>{children}</div>
      </div>
    </>
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
