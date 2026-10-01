import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ExamAttempt } from '@/exam/types';
import { useExamStore } from '@/state/examStore';
import { useSharedDocumentStore } from '@/state/sharedDocumentStore';
import { snapshotWorkbook, type WorkbookSnapshot } from './model/snapshot';
import { useSharedWorkbookAnswers } from './useSharedWorkbookAnswers';
import { WorkbookStore } from './WorkbookStore';

/*
 * A single-workbook sitting: one workbook, every question answered on it, and
 * each visit recorded against the question that was open.
 */

function startingSheet(): WorkbookSnapshot {
  const store = new WorkbookStore();
  store.setCellInput(0, 0, 'Name');
  store.setCellInput(0, 1, 'Fee');
  store.setCellInput(1, 0, 'Rahul');
  store.setCellInput(1, 1, '5000');
  return snapshotWorkbook(store.workbook);
}

function attemptOn(start: WorkbookSnapshot): ExamAttempt {
  return {
    candidateName: 'Candidate',
    subject: 'excel',
    durationSeconds: 600,
    sharedWorkbook: start,
    sections: [
      {
        name: 'Spreadsheet',
        questions: [1, 2, 3].map((number) => ({
          subject: 'excel' as const,
          number,
          topic: 'Cell Formatting',
          difficulty: 'Easy' as const,
          instruction: { en: `Q${number}`, hi: `Q${number}` },
          solution: { en: [], hi: [] },
          workbook: { en: start, hi: start },
          modelAnswer: {},
          marks: 1,
          bookmarked: false,
        })),
      },
    ],
  };
}

const bold = (store: WorkbookStore) => {
  store.selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 0, col: 1 } });
  store.applyStyle({ bold: true }, 'Bold');
};

describe('useSharedWorkbookAnswers', () => {
  let store: WorkbookStore;
  let start: WorkbookSnapshot;

  beforeEach(() => {
    store = new WorkbookStore();
    start = startingSheet();
    act(() => {
      useExamStore.getState().setAttempt(attemptOn(start));
      useExamStore.getState().startAttempt('en');
    });
  });

  const mount = () => renderHook(() => useSharedWorkbookAnswers(store, true));

  it('loads the starting workbook once and records nothing yet', () => {
    mount();
    expect(snapshotWorkbook(store.workbook)).toEqual(start);
    expect(useSharedDocumentStore.getState().timeline).toEqual([]);
  });

  it('records a visit against the question that was open, and keeps the workbook across questions', () => {
    mount();
    act(() => bold(store));
    act(() => useExamStore.getState().selectQuestion(2));

    const { timeline } = useSharedDocumentStore.getState();
    expect(timeline.map((entry) => entry.question)).toEqual([1]);
    // Question 2 opens on the same workbook, bold and all.
    expect(store.styleAt(0, 0).bold).toBe(true);
    expect(useExamStore.getState().answers[1]).toBeDefined();
    expect(useExamStore.getState().answers[2]).toBeUndefined();
  });

  it('records nothing for a visit that changed nothing', () => {
    mount();
    act(() => useExamStore.getState().selectQuestion(2));
    act(() => useExamStore.getState().selectQuestion(3));
    expect(useSharedDocumentStore.getState().timeline).toEqual([]);
  });

  it('gives each visit its own undo history', () => {
    mount();
    act(() => bold(store));
    act(() => useExamStore.getState().selectQuestion(2));
    // Nothing to undo on question 2: question 1's bold is not reachable.
    expect(store.commands.canUndo()).toBe(false);
  });

  it('clears only the current visit', () => {
    const hook = mount();
    act(() => bold(store));
    act(() => useExamStore.getState().selectQuestion(2));
    act(() => store.setCellInput(2, 0, 'Total'));
    act(() => hook.result.current.clearCurrent());

    expect(store.workbook.activeSheet()!.getCell(2, 0)).toBeUndefined();
    expect(store.styleAt(0, 0).bold).toBe(true);
    expect(useSharedDocumentStore.getState().timeline.map((entry) => entry.question)).toEqual([1]);
    expect(useExamStore.getState().answers[2]).toBeUndefined();
  });

  it('records the open question on save, as Submit and the timeout do', () => {
    const hook = mount();
    act(() => store.setCellInput(2, 0, 'Total'));
    act(() => hook.result.current.saveCurrent());
    expect(useSharedDocumentStore.getState().timeline.map((entry) => entry.question)).toEqual([1]);
  });
});
