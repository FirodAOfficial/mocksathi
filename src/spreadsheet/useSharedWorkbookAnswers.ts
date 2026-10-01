'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useExamStore } from '@/state/examStore';
import { useSharedDocumentStore, type SharedTimelineEntry } from '@/state/sharedDocumentStore';
import { snapshotWorkbook, snapshotsEqual, workbookFromSnapshot, type WorkbookSnapshot } from './model/snapshot';
import type { QuestionWorkbooks } from './useQuestionWorkbooks';
import type { WorkbookStore } from './WorkbookStore';

/**
 * Binds the spreadsheet to a single-workbook paper.
 *
 * The counterpart of `useSharedDocumentAnswers`, and the alternative to
 * `useQuestionWorkbooks`'s workbook per question: one workbook for the whole
 * sitting, and every time the candidate leaves a question (or saves, or the
 * clock runs out) the workbook as it stands is added to the timeline against
 * the question that was open — if anything changed while it was. The marker
 * judges each question only on its own visits (`workbookMarker`).
 *
 * Each visit gets a fresh undo history (`store.load` rebuilds the command bus),
 * so Undo on question 5 cannot reach back into question 4's work.
 */

interface OpenVisit {
  number: number;
  /** The workbook when the question was opened — what Clear puts back. */
  workbook: WorkbookSnapshot;
  timeline: SharedTimelineEntry[];
}

export function useSharedWorkbookAnswers(store: WorkbookStore, enabled: boolean): QuestionWorkbooks {
  const start = useExamStore((state) => state.attempt.sharedWorkbook);
  const selectedNumber = useExamStore((state) => state.selectedNumber);
  const saveAnswer = useExamStore((state) => state.saveAnswer);
  const clearAnswer = useExamStore((state) => state.clearAnswer);

  const installedRef = useRef<WorkbookSnapshot | null>(null);
  const openRef = useRef<OpenVisit | null>(null);
  /** The workbook at the last point something was recorded. */
  const recordedRef = useRef<WorkbookSnapshot | null>(null);

  /** Loads a workbook with a fresh undo history, and reads it back canonical. */
  const install = useCallback(
    (snapshot: WorkbookSnapshot): WorkbookSnapshot => {
      store.load(workbookFromSnapshot(snapshot));
      return snapshotWorkbook(store.workbook);
    },
    [store],
  );

  const commit = useCallback(
    (number: number): void => {
      const current = snapshotWorkbook(store.workbook);
      if (recordedRef.current && snapshotsEqual(current, recordedRef.current)) return;
      useSharedDocumentStore.getState().record(number, current);
      saveAnswer(number, current);
      recordedRef.current = current;
    },
    [store, saveAnswer],
  );

  useEffect(() => {
    if (!enabled || !start) return;

    // A new sitting: the starting workbook goes in and nothing is recorded yet.
    if (installedRef.current !== start) {
      const opened = install(start);
      useSharedDocumentStore.getState().reset();
      installedRef.current = start;
      recordedRef.current = opened;
      openRef.current = { number: selectedNumber, workbook: opened, timeline: [] };
      return;
    }

    const open = openRef.current;
    if (!open || open.number === selectedNumber) return;

    // Leaving a question: record what was done while it was open, and start the
    // next one on the same workbook with a clean undo history.
    commit(open.number);
    const opened = install(snapshotWorkbook(store.workbook));
    recordedRef.current = opened;
    openRef.current = { number: selectedNumber, workbook: opened, timeline: useSharedDocumentStore.getState().timeline };
  }, [enabled, start, selectedNumber, install, commit, store]);

  /** Undoes this visit only — see `useSharedDocumentAnswers.clearCurrent`. */
  const clearCurrent = useCallback(() => {
    const open = openRef.current;
    if (!open) return;

    recordedRef.current = install(open.workbook);
    useSharedDocumentStore.getState().restore(open.timeline);

    const earlier = [...open.timeline].reverse().find((entry) => entry.question === open.number);
    if (earlier) saveAnswer(open.number, earlier.document);
    else clearAnswer(open.number);
  }, [install, saveAnswer, clearAnswer]);

  const saveCurrent = useCallback(() => {
    if (openRef.current) commit(openRef.current.number);
  }, [commit]);

  return { clearCurrent, saveCurrent };
}
