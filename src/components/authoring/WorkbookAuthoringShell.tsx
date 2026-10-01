'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EXCEL_TOPICS } from '@/exam/authoring/topics';
import { flattenWorkbook, type FlatWorkbook } from '@/exam/marking/sheet/flattenWorkbook';
import { replayWorkbook } from '@/exam/workbook/apply';
import { describeWorkbookChange, describeWorkbookStep, suggestWorkbookInstruction } from '@/exam/workbook/describe';
import { detectWorkbookChanges, type WorkbookDetection } from '@/exam/workbook/detect';
import { workbookOverlapWarnings } from '@/exam/workbook/record';
import { workbookTopicsFor } from '@/exam/workbook/topics';
import type { WorkbookStep } from '@/exam/workbook/types';
import {
  blankSnapshot,
  snapshotsEqual,
  snapshotWorkbook,
  workbookFromSnapshot,
  type WorkbookSnapshot,
} from '@/spreadsheet/model/snapshot';
import { WorkbookProvider, useWorkbookStore, useWorkbookVersion } from '@/spreadsheet/useWorkbook';
import { WorkbookStore } from '@/spreadsheet/WorkbookStore';
import { useSpreadsheetUiStore } from '@/state/spreadsheetUiStore';
import { ToolbarButton } from '../controls/ToolbarButton';
import { FormulaBar } from '../spreadsheet/FormulaBar';
import { SheetTabs } from '../spreadsheet/SheetTabs';
import { SpreadsheetGrid } from '../spreadsheet/grid/SpreadsheetGrid';
import { SpreadsheetRibbon } from '../spreadsheet/ribbon/SpreadsheetRibbon';
import { SpreadsheetStatusBar } from '../spreadsheet/SpreadsheetStatusBar';
import sheetStyles from '../spreadsheet/SpreadsheetShell.module.css';
import { AuthoringQuestionForm, AuthoringQuestionList, AuthoringStartPanel } from './AuthoringPanels';
import styles from './DocumentAuthoringShell.module.css';
import { useAuthoringFlow, type AuthoringQuestion } from './useAuthoringFlow';

/**
 * Writing an Excel paper on one workbook.
 *
 * The spreadsheet counterpart of `DocumentAuthoringShell`, sharing its list,
 * form and requests (`useAuthoringFlow`, `AuthoringPanels`). The admin enters
 * the starting sheet once, then records each question by performing it with the
 * real ribbon, formula bar and grid; what changed is detected from the workbook
 * before and after (`detectWorkbookChanges`) and shown as it happens, and the
 * server detects it again from the workbook it is sent before storing it.
 *
 * Each question is recorded on the sheet as the previous ones left it — the
 * starting sheet with every stored question replayed (`replayWorkbook`).
 */

export interface WorkbookAuthoringShellProps {
  testId: string;
  testName: string;
  /** The saved starting sheet, or null before one has been saved. */
  workbook: WorkbookSnapshot | null;
  questions: AuthoringQuestion<WorkbookStep>[];
}

const summarise = (steps: WorkbookStep[]): string[] => steps.map(describeWorkbookChange);

export function WorkbookAuthoringShell(props: WorkbookAuthoringShellProps) {
  // Created once, never in state: the store is mutable and owns Maps.
  const [store] = useState(() => new WorkbookStore());
  return (
    <WorkbookProvider value={store}>
      <ShellBody {...props} />
    </WorkbookProvider>
  );
}

/** The current workbook, or null if it is too large to snapshot. */
function snapshotOf(store: WorkbookStore): WorkbookSnapshot | null {
  try {
    return snapshotWorkbook(store.workbook);
  } catch {
    return null;
  }
}

function ShellBody({ testId, testName, workbook, questions }: WorkbookAuthoringShellProps) {
  const store = useWorkbookStore();
  const version = useWorkbookVersion();
  const showFormulaBar = useSpreadsheetUiStore((state) => state.showFormulaBar);
  const setReadOnly = useSpreadsheetUiStore((state) => state.setReadOnly);

  const flow = useAuthoringFlow<WorkbookStep>({
    testId,
    kind: 'workbook',
    questions,
    hasStart: workbook !== null,
    topicOptions: EXCEL_TOPICS,
    startLabel: 'Sheet',
  });
  const { editing } = flow;

  /** What the sheet opens on, and what changes are measured from — as for Word. */
  const { baseline, start } = useMemo(() => {
    if (flow.mode === 'passage' || !workbook) return { baseline: null, start: workbook ?? blankSnapshot() };
    if (!editing) {
      const after = replayWorkbook(workbook, questions);
      return { baseline: after, start: after };
    }
    return {
      baseline: replayWorkbook(workbook, questions.filter((question) => question.position < editing.position)),
      start: replayWorkbook(workbook, questions.filter((question) => question.position <= editing.position)),
    };
  }, [flow.mode, editing, workbook, questions]);

  const baselineFlat = useMemo<FlatWorkbook | null>(() => (baseline ? flattenWorkbook(baseline) : null), [baseline]);

  const installedRef = useRef<WorkbookSnapshot | null>(null);
  const [detection, setDetection] = useState<WorkbookDetection | null>(null);
  const [dirty, setDirty] = useState(false);

  // Put the right sheet in front of the admin whenever what they are doing
  // changes. `load` also gives it a fresh undo history.
  useEffect(() => {
    store.load(workbookFromSnapshot(start));
    installedRef.current = snapshotOf(store);
  }, [store, start]);

  // Re-read what was done after every edit, debounced.
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = snapshotOf(store);
      if (!current) {
        setDetection({ steps: [], problems: ['The sheet is too large to record.'] });
        return;
      }
      setDirty(installedRef.current !== null && !snapshotsEqual(current, installedRef.current));
      setDetection(baselineFlat ? detectWorkbookChanges(baselineFlat, flattenWorkbook(current)) : null);
    }, 150);
    return () => clearTimeout(timer);
  }, [store, version, baselineFlat]);

  // The starting sheet cannot be edited once questions are recorded on it.
  useEffect(() => {
    setReadOnly(flow.mode === 'passage' && flow.locked);
    return () => setReadOnly(false);
  }, [setReadOnly, flow.mode, flow.locked]);

  // The keyboard commands Excel keeps regardless of the ribbon — as in `SpreadsheetShell`.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (typing) return;
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        store.undo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        store.redo();
      } else if (key === 'c') {
        event.preventDefault();
        store.copySelection();
      } else if (key === 'x') {
        event.preventDefault();
        store.cutSelection();
      } else if (key === 'v') {
        event.preventDefault();
        store.paste();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [store]);

  const steps = useMemo(() => detection?.steps ?? [], [detection]);
  const problems = detection?.problems ?? [];
  const warnings = useMemo(
    () =>
      workbookOverlapWarnings(
        steps,
        questions
          .filter((question) => question.id !== editing?.id)
          .map((question) => ({ number: question.position, steps: question.steps })),
      ),
    [steps, questions, editing?.id],
  );

  const detectedTopics = useMemo(() => workbookTopicsFor(steps), [steps]);
  const topics = flow.form.topicsChosen ? flow.form.topics : detectedTopics;

  function resetSheet(): void {
    store.load(workbookFromSnapshot(start));
    installedRef.current = snapshotOf(store);
    setDirty(false);
  }

  const modeLabel =
    flow.mode === 'passage'
      ? flow.locked
        ? 'Sheet (locked)'
        : 'Entering the sheet'
      : editing
        ? `Editing question ${editing.position}`
        : `Recording question ${flow.number}`;

  return (
    <div className={styles.shell}>
      <header className={sheetStyles.titleBar}>
        <div className={sheetStyles.quickAccess} role="toolbar" aria-label="Quick Access Toolbar">
          <ToolbarButton
            label="Undo"
            icon="undo"
            disabled={!store.commands.canUndo()}
            disabledReason="nothing to undo"
            onClick={() => store.undo()}
          />
          <ToolbarButton
            label="Redo"
            icon="redo"
            disabled={!store.commands.canRedo()}
            disabledReason="nothing to redo"
            onClick={() => store.redo()}
          />
        </div>
        <h1 className={sheetStyles.title}>{testName} — Spreadsheet</h1>
      </header>

      <div className={styles.topBar}>
        <Link href={`/dashboard/admin/tests/${testId}`} className={styles.backLink}>
          ← Back to the test
        </Link>
        <span className={styles.testName}>{testName}</span>
        <span className={styles.modeChip}>{modeLabel}</span>
      </div>

      <SpreadsheetRibbon />
      {showFormulaBar ? <FormulaBar /> : null}

      <div className={styles.workspace}>
        <AuthoringQuestionList
          flow={flow}
          questions={questions}
          hasStart={workbook !== null}
          startLabel="Sheet"
          summarise={summarise}
        />

        <main className={`${styles.main} ${sheetStyles.sheet}`}>
          {flow.mode === 'passage' ? (
            <p className={`${styles.banner} ${flow.locked ? styles.bannerLocked : ''}`}>
              {flow.locked
                ? 'The sheet is fixed: every question is recorded against its cells. Delete all questions to change it.'
                : 'Enter the complete starting sheet — data, labels and any formatting it should start with. Questions are recorded on it next.'}
            </p>
          ) : (
            <p className={styles.banner}>
              {editing
                ? `This is the sheet as question ${editing.position} left it. Change it to re-record the question, or just edit its wording on the right.`
                : `Perform question ${flow.number}’s operation on the sheet — select the cells and use the ribbon or type, exactly as a candidate would. Don’t insert or delete rows or columns.`}
            </p>
          )}
          <SpreadsheetGrid />
          <SheetTabs />
        </main>

        <aside className={styles.right} aria-label="Question details">
          {flow.mode === 'passage' ? (
            <AuthoringStartPanel
              flow={flow}
              startLabel="Sheet"
              hasStart={workbook !== null}
              dirty={dirty}
              questionCount={questions.length}
              onSave={() => {
                const current = snapshotOf(store);
                if (current) void flow.saveStart(current);
              }}
            />
          ) : (
            <AuthoringQuestionForm
              flow={flow}
              detectedLines={steps.map(describeWorkbookStep)}
              problems={problems}
              warnings={warnings}
              topics={topics}
              topicOptions={EXCEL_TOPICS}
              dirty={dirty}
              hasChange={steps.length > 0}
              placeholder="e.g. Enter a formula in B8 that totals the fees in B3:B7."
              onSuggest={() => suggestWorkbookInstruction(steps)}
              onSubmit={() => {
                const current = snapshotOf(store);
                if (!current) return;
                // The workbook only when it was touched: an edit to the wording
                // alone keeps what was recorded.
                void flow.saveQuestion(topics, !editing || dirty ? current : undefined);
              }}
              onReset={resetSheet}
              resetLabel="Reset sheet"
            />
          )}
        </aside>
      </div>

      <SpreadsheetStatusBar />
    </div>
  );
}
