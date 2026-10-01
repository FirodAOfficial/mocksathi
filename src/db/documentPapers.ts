import 'server-only';
import type { JSONContent } from '@tiptap/core';
import { and, asc, eq, gt, max, sql } from 'drizzle-orm';
import { applySteps, project, replay } from '@/exam/document/apply';
import { defaultSolution } from '@/exam/document/describe';
import type { DocumentStep } from '@/exam/document/types';
import type { ExamAttempt, WordQuestion } from '@/exam/types';
import { documentRubricFor } from '@/server/marking/documentRubric';
import type { QuestionRubric } from '@/exam/marking/criteria';
import { db } from './client';
import type { ParsedDocumentQuestionFields } from './documentPaperInput';
import {
  tests,
  wordDocPapers,
  wordDocQuestions,
  type NewWordDocQuestion,
  type Test,
  type WordDocQuestion,
} from './schema';

/**
 * Reading and writing single-document Word papers.
 *
 * The counterpart of `tests.ts` for the two tables this flow owns
 * (`word_doc_papers`, `word_doc_questions`). Everything that reads them goes
 * through here, so removing the flow is removing this module, its callers'
 * branches, and the two tables.
 *
 * `server-only` for the same reason as `tests.ts`: the answer key is derived
 * from the same `steps` (`documentRubricFor`), and must never be bundled for
 * a client.
 */

/** A question as the rest of the app needs it: the row, with its steps typed. */
export interface DocumentQuestion extends Omit<WordDocQuestion, 'steps'> {
  steps: DocumentStep[];
}

export interface DocumentPaper {
  testId: string;
  /** The passage every question is performed on, as stored (normalised). */
  passage: JSONContent;
  questions: DocumentQuestion[];
}

function fromRow(row: WordDocQuestion): DocumentQuestion {
  return { ...row, steps: row.steps as DocumentStep[] };
}

/* -- Reading --------------------------------------------------------------- */

export async function getPassage(testId: string): Promise<JSONContent | null> {
  const [row] = await db.select().from(wordDocPapers).where(eq(wordDocPapers.testId, testId)).limit(1);
  return row ? (row.document as JSONContent) : null;
}

export async function documentQuestionsFor(testId: string): Promise<DocumentQuestion[]> {
  const rows = await db
    .select()
    .from(wordDocQuestions)
    .where(eq(wordDocQuestions.testId, testId))
    .orderBy(asc(wordDocQuestions.position));
  return rows.map(fromRow);
}

export async function getDocumentQuestion(id: string): Promise<DocumentQuestion | null> {
  const [row] = await db.select().from(wordDocQuestions).where(eq(wordDocQuestions.id, id)).limit(1);
  return row ? fromRow(row) : null;
}

/** The paper, or null when no passage has been saved for this test. */
export async function getDocumentPaper(testId: string): Promise<DocumentPaper | null> {
  const [passage, questions] = await Promise.all([getPassage(testId), documentQuestionsFor(testId)]);
  return passage ? { testId, passage, questions } : null;
}

/**
 * The document a question is recorded on: the passage with every question
 * before `position` replayed onto it, in order.
 *
 * With no position, the document after *every* question — where the next new
 * one is recorded.
 */
export function documentBefore(paper: DocumentPaper, position?: number): JSONContent {
  const earlier = position === undefined ? paper.questions : paper.questions.filter((question) => question.position < position);
  return replay(paper.passage, earlier);
}

/* -- Writing --------------------------------------------------------------- */

/** Saves the passage. The caller refuses this once questions exist — see the route. */
export async function savePassage(testId: string, passage: JSONContent): Promise<void> {
  const now = new Date();
  await db
    .insert(wordDocPapers)
    .values({ testId, document: passage, updatedAt: now })
    .onConflictDoUpdate({ target: wordDocPapers.testId, set: { document: passage, updatedAt: now } });
}

/** Appends a question, numbered after the last. */
export async function addDocumentQuestion(
  testId: string,
  fields: ParsedDocumentQuestionFields,
  steps: DocumentStep[],
): Promise<DocumentQuestion> {
  return db.transaction(async (tx) => {
    const [highest] = await tx
      .select({ position: max(wordDocQuestions.position) })
      .from(wordDocQuestions)
      .where(eq(wordDocQuestions.testId, testId));

    const values: NewWordDocQuestion = { testId, position: (highest?.position ?? 0) + 1, ...fields, steps };
    const [created] = await tx.insert(wordDocQuestions).values(values).returning();
    return fromRow(created!);
  });
}

/** Replaces a question's wording, and its recorded steps when it was re-recorded. */
export async function updateDocumentQuestion(
  id: string,
  fields: ParsedDocumentQuestionFields,
  steps?: DocumentStep[],
): Promise<DocumentQuestion | null> {
  const [updated] = await db
    .update(wordDocQuestions)
    .set({ ...fields, ...(steps ? { steps } : {}), updatedAt: new Date() })
    .where(eq(wordDocQuestions.id, id))
    .returning();
  return updated ? fromRow(updated) : null;
}

/**
 * Removes a question and closes the gap, one row at a time in ascending order —
 * the same reasoning as `deleteQuestion` in `tests.ts`, against the same kind
 * of plain unique constraint on `(test_id, position)`.
 *
 * Safe anywhere in the paper: no stored document depends on it. The next
 * question is recorded on a replay of whatever questions remain.
 */
export async function deleteDocumentQuestion(question: DocumentQuestion): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(wordDocQuestions).where(eq(wordDocQuestions.id, question.id));

    const remaining = await tx
      .select({ id: wordDocQuestions.id })
      .from(wordDocQuestions)
      .where(and(eq(wordDocQuestions.testId, question.testId), gt(wordDocQuestions.position, question.position)))
      .orderBy(asc(wordDocQuestions.position));

    for (const [index, row] of remaining.entries()) {
      await tx
        .update(wordDocQuestions)
        .set({ position: question.position + index })
        .where(eq(wordDocQuestions.id, row.id));
    }
  });
}

/* -- Rows to a paper ------------------------------------------------------- */

/**
 * The paper as the attempt the player renders.
 *
 * An ordinary `ExamAttempt`, so the palette, the timer and the result screens
 * render it without knowing. Two things set it apart: `sharedDocument`, which
 * switches the editor to one document for the whole sitting, and each
 * question's `answerDocument` — the passage with that question alone
 * replayed — which the solutions screen shows as the worked answer.
 *
 * Every question's `passage` is the shared passage, in both languages: the
 * paper has one passage, and only the instructions are offered in Hindi.
 */
export function attemptFromDocumentPaper(
  test: Test,
  paper: DocumentPaper,
  candidateName = 'Candidate',
): ExamAttempt {
  const base = project(paper.passage);

  const questions: WordQuestion[] = paper.questions.map((question) => {
    const fallback = defaultSolution(base, question.steps);
    return {
      subject: 'word',
      number: question.position,
      topic: question.topic,
      difficulty: question.difficulty,
      instruction: { en: question.instructionEn, hi: question.instructionHi },
      solution: {
        en: question.solutionEn.length > 0 ? question.solutionEn : fallback,
        hi: question.solutionHi.length > 0 ? question.solutionHi : fallback,
      },
      passage: { en: paper.passage, hi: paper.passage },
      // Kept for the shape; `answerDocument` is what is shown.
      modelAnswer: { scope: 'all' },
      answerDocument: applySteps(paper.passage, question.steps),
      marks: question.marks,
      bookmarked: false,
    };
  });

  return {
    candidateName,
    subject: 'word',
    durationSeconds: test.durationMinutes * 60,
    sharedDocument: paper.passage,
    sections: [{ name: test.sectionName, questions }],
  };
}

/** The answer key for the whole paper. */
export function documentRubrics(paper: DocumentPaper): QuestionRubric[] {
  const base = project(paper.passage);
  return paper.questions.map((question) => documentRubricFor(question.position, question.steps, base));
}

/** What the instructions and result screens call the paper — `paperIdentityFor`, for this flow. */
export function documentPaperIdentity(
  test: Test,
  paper: DocumentPaper,
): { testName: string; tagline: string; maximumMarks: number; qualifyingMarks: number } {
  return {
    testName: test.name,
    tagline: test.tagline ?? 'Your Progress Brings You Closer to Success',
    maximumMarks: paper.questions.reduce((total, question) => total + question.marks, 0),
    qualifyingMarks: test.qualifyingMarks,
  };
}

/* -- For the shared list queries in `tests.ts` ------------------------------ */

/*
 * Correlated subqueries rather than a second join: `tests.ts` already
 * left-joins `test_questions` and groups by test, and joining this table as
 * well would multiply the two sets of rows into each other's counts.
 */

/** How many single-document questions the current `tests` row has. */
export const documentQuestionCount = sql<string>`(select count(*) from ${wordDocQuestions} where ${wordDocQuestions.testId} = ${tests.id})`;

/** What they are worth together; null when there are none. */
export const documentQuestionMarks = sql<string | null>`(select sum(${wordDocQuestions.marks}) from ${wordDocQuestions} where ${wordDocQuestions.testId} = ${tests.id})`;

/** True when the current `tests` row has at least one single-document question. */
export const hasDocumentQuestions = sql<boolean>`exists (select 1 from ${wordDocQuestions} where ${wordDocQuestions.testId} = ${tests.id})`;
