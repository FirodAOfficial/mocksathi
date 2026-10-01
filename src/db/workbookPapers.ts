import 'server-only';
import { and, asc, eq, gt, max, sql } from 'drizzle-orm';
import { applyWorkbookSteps, replayWorkbook } from '@/exam/workbook/apply';
import { defaultWorkbookSolution } from '@/exam/workbook/describe';
import type { WorkbookStep } from '@/exam/workbook/types';
import type { ExamAttempt, ExcelQuestion } from '@/exam/types';
import type { SheetQuestionRubric } from '@/exam/marking/sheet/criteria';
import { workbookRubricFor } from '@/server/marking/workbookRubric';
import type { WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import { db } from './client';
import type { ParsedDocumentQuestionFields } from './documentPaperInput';
import { excelDocPapers, excelDocQuestions, tests, type ExcelDocQuestion, type NewExcelDocQuestion, type Test } from './schema';

/**
 * Reading and writing single-workbook Excel papers — `excel_doc_papers` and
 * `excel_doc_questions`. The counterpart of `documentPapers.ts`, and like it
 * the only module that reads these tables, so the flow is removable.
 *
 * `server-only`: the answer key is derived from the same `steps`.
 */

export interface WorkbookQuestion extends Omit<ExcelDocQuestion, 'steps'> {
  steps: WorkbookStep[];
}

export interface WorkbookPaper {
  testId: string;
  /** The sheet every question is performed on, as stored (normalised). */
  workbook: WorkbookSnapshot;
  questions: WorkbookQuestion[];
}

function fromRow(row: ExcelDocQuestion): WorkbookQuestion {
  return { ...row, steps: row.steps as WorkbookStep[] };
}

/* -- Reading --------------------------------------------------------------- */

export async function getStartingWorkbook(testId: string): Promise<WorkbookSnapshot | null> {
  const [row] = await db.select().from(excelDocPapers).where(eq(excelDocPapers.testId, testId)).limit(1);
  return row ? (row.workbook as WorkbookSnapshot) : null;
}

export async function workbookQuestionsFor(testId: string): Promise<WorkbookQuestion[]> {
  const rows = await db
    .select()
    .from(excelDocQuestions)
    .where(eq(excelDocQuestions.testId, testId))
    .orderBy(asc(excelDocQuestions.position));
  return rows.map(fromRow);
}

export async function getWorkbookQuestion(id: string): Promise<WorkbookQuestion | null> {
  const [row] = await db.select().from(excelDocQuestions).where(eq(excelDocQuestions.id, id)).limit(1);
  return row ? fromRow(row) : null;
}

export async function getWorkbookPaper(testId: string): Promise<WorkbookPaper | null> {
  const [workbook, questions] = await Promise.all([getStartingWorkbook(testId), workbookQuestionsFor(testId)]);
  return workbook ? { testId, workbook, questions } : null;
}

/** The workbook a question is recorded on: the start with every earlier question replayed. */
export function workbookBefore(paper: WorkbookPaper, position?: number): WorkbookSnapshot {
  const earlier =
    position === undefined ? paper.questions : paper.questions.filter((question) => question.position < position);
  return replayWorkbook(paper.workbook, earlier);
}

/* -- Writing --------------------------------------------------------------- */

export async function saveStartingWorkbook(testId: string, workbook: WorkbookSnapshot): Promise<void> {
  const now = new Date();
  await db
    .insert(excelDocPapers)
    .values({ testId, workbook, updatedAt: now })
    .onConflictDoUpdate({ target: excelDocPapers.testId, set: { workbook, updatedAt: now } });
}

export async function addWorkbookQuestion(
  testId: string,
  fields: ParsedDocumentQuestionFields,
  steps: WorkbookStep[],
): Promise<WorkbookQuestion> {
  return db.transaction(async (tx) => {
    const [highest] = await tx
      .select({ position: max(excelDocQuestions.position) })
      .from(excelDocQuestions)
      .where(eq(excelDocQuestions.testId, testId));

    const values: NewExcelDocQuestion = { testId, position: (highest?.position ?? 0) + 1, ...fields, steps };
    const [created] = await tx.insert(excelDocQuestions).values(values).returning();
    return fromRow(created!);
  });
}

export async function updateWorkbookQuestion(
  id: string,
  fields: ParsedDocumentQuestionFields,
  steps?: WorkbookStep[],
): Promise<WorkbookQuestion | null> {
  const [updated] = await db
    .update(excelDocQuestions)
    .set({ ...fields, ...(steps ? { steps } : {}), updatedAt: new Date() })
    .where(eq(excelDocQuestions.id, id))
    .returning();
  return updated ? fromRow(updated) : null;
}

/** Removes a question and closes the gap, ascending — see `deleteDocumentQuestion`. */
export async function deleteWorkbookQuestion(question: WorkbookQuestion): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(excelDocQuestions).where(eq(excelDocQuestions.id, question.id));

    const remaining = await tx
      .select({ id: excelDocQuestions.id })
      .from(excelDocQuestions)
      .where(and(eq(excelDocQuestions.testId, question.testId), gt(excelDocQuestions.position, question.position)))
      .orderBy(asc(excelDocQuestions.position));

    for (const [index, row] of remaining.entries()) {
      await tx
        .update(excelDocQuestions)
        .set({ position: question.position + index })
        .where(eq(excelDocQuestions.id, row.id));
    }
  });
}

/* -- Rows to a paper ------------------------------------------------------- */

/**
 * The paper as the attempt the player renders: an ordinary `ExamAttempt` whose
 * `sharedWorkbook` switches the spreadsheet to one workbook for the sitting, and
 * whose questions carry `answerWorkbook` — the start with that question alone
 * replayed — for the solutions screen.
 */
export function attemptFromWorkbookPaper(test: Test, paper: WorkbookPaper, candidateName = 'Candidate'): ExamAttempt {
  const questions: ExcelQuestion[] = paper.questions.map((question) => {
    const fallback = defaultWorkbookSolution(question.steps);
    return {
      subject: 'excel',
      number: question.position,
      topic: question.topic,
      difficulty: question.difficulty,
      instruction: { en: question.instructionEn, hi: question.instructionHi },
      solution: {
        en: question.solutionEn.length > 0 ? question.solutionEn : fallback,
        hi: question.solutionHi.length > 0 ? question.solutionHi : fallback,
      },
      workbook: { en: paper.workbook, hi: paper.workbook },
      // Kept for the shape; `answerWorkbook` is what is shown.
      modelAnswer: {},
      answerWorkbook: applyWorkbookSteps(paper.workbook, question.steps),
      marks: question.marks,
      bookmarked: false,
    };
  });

  return {
    candidateName,
    subject: 'excel',
    durationSeconds: test.durationMinutes * 60,
    sharedWorkbook: paper.workbook,
    sections: [{ name: test.sectionName, questions }],
  };
}

export function workbookRubrics(paper: WorkbookPaper): SheetQuestionRubric[] {
  return paper.questions.map((question) => workbookRubricFor(question.position, question.steps));
}

export function workbookPaperIdentity(
  test: Test,
  paper: WorkbookPaper,
): { testName: string; tagline: string; maximumMarks: number; qualifyingMarks: number } {
  return {
    testName: test.name,
    tagline: test.tagline ?? 'Your Progress Brings You Closer to Success',
    maximumMarks: paper.questions.reduce((total, question) => total + question.marks, 0),
    qualifyingMarks: test.qualifyingMarks,
  };
}

/* -- For the shared list queries in `tests.ts` ------------------------------ */

export const workbookQuestionCount = sql<string>`(select count(*) from ${excelDocQuestions} where ${excelDocQuestions.testId} = ${tests.id})`;
export const workbookQuestionMarks = sql<string | null>`(select sum(${excelDocQuestions.marks}) from ${excelDocQuestions} where ${excelDocQuestions.testId} = ${tests.id})`;
export const hasWorkbookQuestions = sql<boolean>`exists (select 1 from ${excelDocQuestions} where ${excelDocQuestions.testId} = ${tests.id})`;
