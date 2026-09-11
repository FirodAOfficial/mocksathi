'use client';

import { useCallback, useEffect, useRef } from 'react';
import { findQuestion, isExcelQuestion, type ExcelQuestion } from '@/exam/types';
import { useExamStore } from '@/state/examStore';
import {
  snapshotWorkbook,
  snapshotsEqual,
  workbookFromSnapshot,
  type WorkbookSnapshot,
} from './model/snapshot';
import type { WorkbookStore } from './WorkbookStore';

/**
 * Binds the spreadsheet to the selected question.
 *
 * The direct counterpart of `useQuestionAnswers`, and it holds the same two
 * rules:
 *
 * - **Moving to another question banks the current one first.** Whatever the
 *   candidate had done is snapshotted before the workbook is replaced, so
 *   coming back finds it exactly as it was left.
 * - **Only questions actually changed are stored.** A workbook equal to the
 *   one the question started from is cleared instead of saved, which is what
 *   makes "attempted" derived from the answers map rather than a flag that
 *   could disagree with what is on screen.
 */

export interface QuestionWorkbooks {
  /** Restores the open question to its starting workbook. */
  clearCurrent: () => void;
  /** Stores the open question's workbook as it stands. */
  saveCurrent: () => void;
}

export function useQuestionWorkbooks(store: WorkbookStore, enabled: boolean): QuestionWorkbooks {
  const attempt = useExamStore((state) => state.attempt);
  const language = useExamStore((state) => state.language);
  const selectedNumber = useExamStore((state) => state.selectedNumber);
  const saveAnswer = useExamStore((state) => state.saveAnswer);
  const clearAnswer = useExamStore((state) => state.clearAnswer);

  /** The question whose workbook is currently loaded. */
  const installedRef = useRef<number | null>(null);

  const excelQuestion = useCallback(
    (number: number): ExcelQuestion | undefined => {
      const question = findQuestion(attempt, number);
      return question && isExcelQuestion(question) ? question : undefined;
    },
    [attempt],
  );

  const install = useCallback(
    (snapshot: WorkbookSnapshot): void => {
      store.load(workbookFromSnapshot(snapshot));
    },
    [store],
  );

  const persist = useCallback(
    (number: number): void => {
      const question = excelQuestion(number);
      if (!question) return;

      const current = snapshotWorkbook(store.workbook);
      // Both sides come out of `snapshotWorkbook`, so they are already
      // canonical — see `snapshotsEqual`.
      const untouched = snapshotWorkbook(workbookFromSnapshot(question.workbook[language]));

      if (snapshotsEqual(current, untouched)) clearAnswer(number);
      else saveAnswer(number, current);
    },
    [excelQuestion, language, store, saveAnswer, clearAnswer],
  );

  useEffect(() => {
    if (!enabled) return;
    if (installedRef.current === selectedNumber) return;

    const question = excelQuestion(selectedNumber);
    if (!question) return;

    const previous = installedRef.current;
    if (previous !== null) persist(previous);

    const stored = useExamStore.getState().answers[selectedNumber] as WorkbookSnapshot | undefined;
    install(stored ?? question.workbook[language]);

    installedRef.current = selectedNumber;
  }, [enabled, selectedNumber, excelQuestion, language, install, persist]);

  const clearCurrent = useCallback(() => {
    const question = excelQuestion(selectedNumber);
    if (!question) return;

    clearAnswer(selectedNumber);
    install(question.workbook[language]);
  }, [excelQuestion, selectedNumber, language, clearAnswer, install]);

  const saveCurrent = useCallback(() => {
    if (installedRef.current !== null) persist(installedRef.current);
  }, [persist]);

  return { clearCurrent, saveCurrent };
}
