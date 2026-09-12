'use client';

import { useEffect, useState } from 'react';
import { ToolbarButton } from '@/components/controls/ToolbarButton';
import { ExamDrawerBar, ExamPanel, type DrawerSide } from '@/components/exam/ExamPanels';
import { ExamSummaryPanel } from '@/components/exam/ExamSummaryPanel';
import { InstructionStrip } from '@/components/exam/InstructionStrip';
import { QuestionListPanel } from '@/components/exam/QuestionListPanel';
import { ResultView } from '@/components/result/ResultView';
import { EXCEL_SEED_ATTEMPT } from '@/exam/excelSeedAttempt';
import type { ExamResult } from '@/exam/result';
import { SubmissionError, submitAttempt } from '@/exam/submitAttempt';
import type { ExamAttempt, Language } from '@/exam/types';
import { useDrawerLayout } from '@/hooks/useMediaQuery';
import { WorkbookStore } from '@/spreadsheet/WorkbookStore';
import { useQuestionWorkbooks } from '@/spreadsheet/useQuestionWorkbooks';
import { WorkbookProvider, useWorkbookStore, useWorkbookVersion } from '@/spreadsheet/useWorkbook';
import { elapsedSeconds, useExamStore } from '@/state/examStore';
import { useSpreadsheetUiStore } from '@/state/spreadsheetUiStore';
import { FormulaBar } from './FormulaBar';
import { SheetTabs } from './SheetTabs';
import { SpreadsheetGrid } from './grid/SpreadsheetGrid';
import { SpreadsheetRibbon } from './ribbon/SpreadsheetRibbon';
import { SpreadsheetStatusBar } from './SpreadsheetStatusBar';
import styles from './SpreadsheetShell.module.css';

/**
 * The spreadsheet editor, assembled.
 *
 * Mirrors `WordShell`: title bar with the Quick Access Toolbar, ribbon, the
 * document surface, status bar. The differences from Word are the formula bar
 * above the sheet and the tab strip below it, which is where Excel puts them.
 *
 * **Nothing here is saved.** No autosave, no local storage, no background sync.
 * The workbook lives in this tab and disappears when it closes, which is the
 * product's rule and not an omission — a practical exam that silently restored
 * a candidate's earlier attempt would be marking the wrong thing.
 */
export interface SpreadsheetShellProps {
  /**
   * Whether this is an exam sitting.
   *
   * Off, it is a plain spreadsheet: no panels, no clock, no submit. On, the
   * question list and the candidate panel appear beside the sheet and the paper
   * runs to a deadline — the same split `WordShell` makes.
   */
  exam?: boolean;
  /** The language the paper is sat in. Ignored outside an exam. */
  language?: Language;
  /**
   * The authored paper to sit, or null for the sample one.
   *
   * Resolved on the server and passed in, rather than fetched here: the store
   * defaults to the fixture, and a paper that arrived a tick after the clock
   * started would mean the candidate's first seconds were spent on a question
   * that then vanished.
   */
  attempt?: ExamAttempt | null;
  /**
   * Which stored test this is, sent with the submission so the server marks
   * the paper the candidate was actually given.
   *
   * An id, not the paper: the questions, the marks and the answer key are all
   * re-loaded server-side from it, so this cannot be used to influence a score
   * — the same reason `subject` is the only other thing the client gets to say.
   */
  testId?: string | null;
}

export function SpreadsheetShell({
  exam = false,
  language = 'en',
  attempt: paper = null,
  testId = null,
}: SpreadsheetShellProps) {
  // Created once, and never put in state: the store is mutable and owns a
  // workbook of Maps. Passing it through `useState`'s initialiser is how it
  // survives re-renders without React trying to diff it.
  const [store] = useState(() => new WorkbookStore());

  return (
    <WorkbookProvider value={store}>
      <ShellBody exam={exam} examLanguage={language} paper={paper} testId={testId} />
    </WorkbookProvider>
  );
}

function ShellBody({
  exam,
  examLanguage,
  paper,
  testId,
}: {
  exam: boolean;
  examLanguage: Language;
  paper: ExamAttempt | null;
  testId: string | null;
}) {
  const store = useWorkbookStore();
  useWorkbookVersion();

  const showFormulaBar = useSpreadsheetUiStore((state) => state.showFormulaBar);

  const attempt = useExamStore((state) => state.attempt);
  const answers = useExamStore((state) => state.answers);
  const language = useExamStore((state) => state.language);
  const timePerQuestion = useExamStore((state) => state.timePerQuestion);
  const startedAt = useExamStore((state) => state.startedAt);
  const submittedBy = useExamStore((state) => state.submittedBy);
  const setAttempt = useExamStore((state) => state.setAttempt);
  const startAttempt = useExamStore((state) => state.startAttempt);

  const [result, setResult] = useState<ExamResult | null>(null);
  const [markingError, setMarkingError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerSide | null>(null);
  const isMobile = useDrawerLayout();

  // Derived, never reset in an effect: a drawer only exists on the layout that
  // has drawers, and resetting it after a resize would render one frame with a
  // drawer open on a screen that has none.
  const openDrawer = isMobile ? drawer : null;

  const questionWorkbooks = useQuestionWorkbooks(store, exam);

  /*
   * Opening the exam shell starts a sitting: the clock runs from here.
   *
   * It also clears whatever the last paper left behind. The exam store is a
   * client module singleton, so walking back to the instructions and starting
   * again without a full page load would otherwise keep the previous answers —
   * and a stale `submittedBy` would drop the candidate straight back onto the
   * result screen.
   */
  useEffect(() => {
    if (!exam) return;
    // The authored paper, or the sample one when nothing has been published.
    setAttempt(paper ?? EXCEL_SEED_ATTEMPT);
    startAttempt(examLanguage);
  }, [exam, paper, setAttempt, startAttempt, examLanguage]);

  /*
   * The candidate's own name on the panel, once the session check resolves.
   * Fetched rather than passed as a prop: the exam store is a client singleton
   * with no server-rendered page feeding it.
   */
  useEffect(() => {
    if (!exam) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/auth/me', { signal: controller.signal });
        if (!response.ok) return;
        const body = (await response.json()) as { user?: { name?: string } };
        if (body.user?.name) {
          setAttempt({ ...useExamStore.getState().attempt, candidateName: body.user.name });
        }
      } catch {
        // A guest, or an aborted check: the panel keeps its placeholder name.
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
            subject: 'excel',
            testId,
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
    // The answers and the timings are frozen the moment the paper closes, so
    // this deliberately runs once per submission rather than on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedBy]);

  /**
   * The keyboard commands Excel keeps regardless of the ribbon.
   *
   * Deliberately only these. Formatting shortcuts — Ctrl+B and friends — are
   * left inert, exactly as the Word editor leaves them, because the paper tests
   * whether the candidate can find the ribbon control.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey)) return;

      const key = event.key.toLowerCase();
      const target = event.target as HTMLElement | null;
      // Inside an input, the browser's own editing behaviour wins.
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if (key === 'z' && !event.shiftKey) {
        if (typing) return;
        event.preventDefault();
        store.undo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        if (typing) return;
        event.preventDefault();
        store.redo();
      } else if (key === 'c' && !typing) {
        event.preventDefault();
        store.copySelection();
      } else if (key === 'x' && !typing) {
        event.preventDefault();
        store.cutSelection();
      } else if (key === 'v' && !typing) {
        event.preventDefault();
        store.paste();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [store]);

  /*
   * Once the paper closes it is replaced by the result screen rather than being
   * shown locked behind a dialog. The result is where the candidate goes next,
   * so the editor has no further part to play.
   */
  if (exam && submittedBy) {
    if (result) {
      return (
        <ResultView
          result={result}
          attempt={attempt}
          answers={answers}
          language={language}
          backHref="/dashboard"
        />
      );
    }

    return (
      <div className={styles.marking} role="status" aria-live="polite">
        {markingError ? (
          <>
            <p className={styles.markingTitle}>Your paper could not be marked</p>
            <p className={styles.markingDetail}>{markingError}</p>
          </>
        ) : (
          <p className={styles.markingTitle}>Marking your paper…</p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.titleBar}>
        <div className={styles.quickAccess} role="toolbar" aria-label="Quick Access Toolbar">
          <ToolbarButton
            label={store.commands.undoLabel() ? `Undo ${store.commands.undoLabel()}` : 'Undo'}
            icon="undo"
            disabled={!store.commands.canUndo()}
            disabledReason="nothing to undo"
            onClick={() => store.undo()}
          />
          <ToolbarButton
            label={store.commands.redoLabel() ? `Redo ${store.commands.redoLabel()}` : 'Redo'}
            icon="redo"
            disabled={!store.commands.canRedo()}
            disabledReason="nothing to redo"
            onClick={() => store.redo()}
          />
        </div>

        <h1 className={styles.title}>
          {exam ? `${attempt.sections[0]?.name ?? 'Spreadsheet'} — Practical Paper` : 'Book1 — Spreadsheet Editor'}
        </h1>

        {/* Decorative, as in the Word editor: this is a web page, so they are
            hidden from assistive technology rather than faked as controls. */}
        <div className={styles.windowButtons} aria-hidden="true">
          <span className={styles.windowButton}>—</span>
          <span className={styles.windowButton}>▢</span>
          <span className={`${styles.windowButton} ${styles.closeButton}`}>✕</span>
        </div>
      </header>

      <SpreadsheetRibbon />
      {showFormulaBar ? <FormulaBar /> : null}

      {/*
        Three columns: the question list, the sheet being worked in, and the
        candidate summary. Only the middle one holds the grid, so the panels can
        be removed without the grid knowing they existed.
      */}
      <div className={styles.workspace}>
        {exam ? (
          <ExamPanel side="left" open={openDrawer === 'questions'} isMobile={isMobile} onClose={() => setDrawer(null)}>
            <QuestionListPanel />
          </ExamPanel>
        ) : null}

        <main className={styles.sheet}>
          {exam ? <InstructionStrip /> : null}
          <SpreadsheetGrid />
        </main>

        {exam ? (
          <ExamPanel side="right" open={openDrawer === 'summary'} isMobile={isMobile} onClose={() => setDrawer(null)}>
            <ExamSummaryPanel
              onClearAnswer={questionWorkbooks.clearCurrent}
              onSaveAnswer={questionWorkbooks.saveCurrent}
            />
          </ExamPanel>
        ) : null}
      </div>

      {exam && isMobile ? (
        <ExamDrawerBar
          open={openDrawer}
          onToggle={(side) => setDrawer((current) => (current === side ? null : side))}
        />
      ) : null}

      <SheetTabs />
      <SpreadsheetStatusBar />
    </div>
  );
}
