import 'server-only';
import { and, asc, count, desc, eq, gt, max, sum } from 'drizzle-orm';
import {
  buildAttempt,
  workbookFromGrid,
  type ExcelOperation,
  type QuestionDraft,
  type WordOperation,
} from '@/exam/authoring';
import type { MockSummary } from '@/dashboard/types';
import type { ExamAttempt } from '@/exam/types';
import { db } from './client';
import { isUniqueViolation } from './pgErrors';
import {
  exams,
  testQuestions,
  tests,
  type ExcelContentRow,
  type NewTest,
  type NewTestQuestion,
  type Test,
  type TestQuestion,
  type TestSubject,
  type WordContentRow,
} from './schema';
import { slugify } from './slug';
import type { ParsedQuestionFields, ParsedTestFields } from './testInput';

/**
 * Reading and writing authored papers.
 *
 * The one place `test_questions` rows and `src/exam/authoring` meet.
 * `schema.ts` declares the two `jsonb` payloads structurally rather than
 * importing the authoring types — it is read by `drizzle.config.ts`, which
 * runs outside Next's module resolution — so `draftFromRow` is where the
 * assignment is actually checked, once, against the real types.
 *
 * Nothing here reaches the browser: `import 'server-only'`, same as
 * `plans.ts`. That is not about hiding the questions — a candidate sitting the
 * paper is shown them — but about the answer key derived from the same
 * `operations`, which must never be bundled for a client.
 */

/* -- Reading --------------------------------------------------------------- */

export interface TestListRow {
  test: Test;
  examName: string;
  questionCount: number;
  /** What the paper is marked out of, summed from its questions. */
  totalMarks: number;
}

/**
 * Every test, newest first, with the two figures the list screen shows.
 *
 * Counted in the database rather than by loading each paper's questions: the
 * list needs two numbers per row, not fifteen passages per row.
 */
export async function listTests(options: { examId?: string } = {}): Promise<TestListRow[]> {
  const rows = await db
    .select({
      test: tests,
      examName: exams.name,
      questionCount: count(testQuestions.id),
      totalMarks: sum(testQuestions.marks),
    })
    .from(tests)
    .innerJoin(exams, eq(tests.examId, exams.id))
    .leftJoin(testQuestions, eq(testQuestions.testId, tests.id))
    .where(options.examId ? eq(tests.examId, options.examId) : undefined)
    .groupBy(tests.id, exams.name)
    .orderBy(desc(tests.createdAt));

  return rows.map((row) => ({
    test: row.test,
    examName: row.examName,
    questionCount: Number(row.questionCount ?? 0),
    // `sum` comes back as a string from `pg` (bigint/numeric), and null for a
    // paper with no questions yet.
    totalMarks: Number(row.totalMarks ?? 0),
  }));
}

export async function getTestById(id: string): Promise<Test | null> {
  const [test] = await db.select().from(tests).where(eq(tests.id, id)).limit(1);
  return test ?? null;
}

export async function getTestBySlug(slug: string): Promise<Test | null> {
  const [test] = await db.select().from(tests).where(eq(tests.slug, slug)).limit(1);
  return test ?? null;
}

/** A paper's questions in the order the candidate meets them. */
export async function questionsForTest(testId: string): Promise<TestQuestion[]> {
  return db.select().from(testQuestions).where(eq(testQuestions.testId, testId)).orderBy(asc(testQuestions.position));
}

export async function getQuestionById(id: string): Promise<TestQuestion | null> {
  const [question] = await db.select().from(testQuestions).where(eq(testQuestions.id, id)).limit(1);
  return question ?? null;
}

/* -- Writing --------------------------------------------------------------- */

/**
 * Creates a test, giving it a slug from its name.
 *
 * Same collision handling as `POST /api/admin/exams`: two papers called "Word
 * Practical 1" is an ordinary thing for an admin to want, so a 23505 gets a
 * short suffix rather than an error.
 */
export async function createTest(fields: ParsedTestFields, createdBy: string): Promise<Test> {
  const baseSlug = slugify(fields.name) || 'test';
  const values: NewTest = { ...fields, slug: baseSlug, createdBy };

  try {
    const [created] = await db.insert(tests).values(values).returning();
    return created!;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [created] = await db
      .insert(tests)
      .values({ ...values, slug: `${baseSlug}-${crypto.randomUUID().slice(0, 6)}` })
      .returning();
    return created!;
  }
}

/**
 * Replaces a test's fields.
 *
 * The subject is not among them once the paper has questions: switching a Word
 * paper to Excel would leave every question holding a passage the spreadsheet
 * shell cannot open. The route refuses that rather than this silently dropping
 * it, so the admin is told why.
 */
export async function updateTest(id: string, fields: ParsedTestFields, existing: Test): Promise<Test | null> {
  // Only regenerate the slug when the name actually changed, so an edit that
  // leaves the name alone cannot reassign a published paper's address.
  const baseSlug = fields.name === existing.name ? existing.slug : slugify(fields.name) || 'test';
  const values = { ...fields, slug: baseSlug, updatedAt: new Date() };

  try {
    const [updated] = await db.update(tests).set(values).where(eq(tests.id, id)).returning();
    return updated ?? null;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [updated] = await db
      .update(tests)
      .set({ ...values, slug: `${baseSlug}-${crypto.randomUUID().slice(0, 6)}` })
      .where(eq(tests.id, id))
      .returning();
    return updated ?? null;
  }
}

export async function deleteTest(id: string): Promise<void> {
  // `test_questions.test_id` cascades, so the questions go with it.
  await db.delete(tests).where(eq(tests.id, id));
}

/** Appends a question to the end of a paper. */
export async function addQuestion(testId: string, fields: ParsedQuestionFields): Promise<TestQuestion> {
  return db.transaction(async (tx) => {
    const [highest] = await tx
      .select({ position: max(testQuestions.position) })
      .from(testQuestions)
      .where(eq(testQuestions.testId, testId));

    const values: NewTestQuestion = {
      testId,
      position: (highest?.position ?? 0) + 1,
      subject: fields.subject,
      topic: fields.topic,
      difficulty: fields.difficulty,
      marks: fields.marks,
      instructionEn: fields.instructionEn,
      instructionHi: fields.instructionHi,
      solutionEn: fields.solutionEn,
      solutionHi: fields.solutionHi,
      content: fields.content,
      operations: fields.operations,
    };

    const [created] = await tx.insert(testQuestions).values(values).returning();
    return created!;
  });
}

/** Replaces a question's fields. Its position is changed by `moveQuestion`, not here. */
export async function updateQuestion(id: string, fields: ParsedQuestionFields): Promise<TestQuestion | null> {
  const [updated] = await db
    .update(testQuestions)
    .set({
      subject: fields.subject,
      topic: fields.topic,
      difficulty: fields.difficulty,
      marks: fields.marks,
      instructionEn: fields.instructionEn,
      instructionHi: fields.instructionHi,
      solutionEn: fields.solutionEn,
      solutionHi: fields.solutionHi,
      content: fields.content,
      operations: fields.operations,
      updatedAt: new Date(),
    })
    .where(eq(testQuestions.id, id))
    .returning();

  return updated ?? null;
}

/**
 * Removes a question and closes the gap it leaves.
 *
 * Positions have to stay 1..n with nothing missing: they are the numbers the
 * palette, the instructions screen and the result all call the questions, and
 * a paper that jumps from 6 to 8 reads as a question that failed to load.
 *
 * Renumbered one row at a time in ascending order, rather than with a single
 * `position = position - 1` over everything after the gap. `(test_id,
 * position)` is a plain unique constraint, so Postgres checks it per row as an
 * `UPDATE` goes — and the order it visits rows in is not defined. Visiting 6
 * before 5 would try to claim a slot 5 still holds. Ascending and explicit,
 * every target slot is provably free before it is claimed: the first one by
 * the delete, each later one by the row that just left it. A paper is a couple
 * of dozen questions, so the extra statements cost nothing worth having a
 * deferrable constraint for.
 */
export async function deleteQuestion(question: TestQuestion): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(testQuestions).where(eq(testQuestions.id, question.id));

    const remaining = await tx
      .select({ id: testQuestions.id })
      .from(testQuestions)
      .where(and(eq(testQuestions.testId, question.testId), gt(testQuestions.position, question.position)))
      .orderBy(asc(testQuestions.position));

    for (const [index, row] of remaining.entries()) {
      await tx
        .update(testQuestions)
        .set({ position: question.position + index })
        .where(eq(testQuestions.id, row.id));
    }
  });
}

/**
 * Swaps a question with its neighbour.
 *
 * Through a position no row can hold (`-1`), because `(test_id, position)` is
 * unique and the intermediate state of a straight swap is two rows in the same
 * slot. Returns false when there is no neighbour to swap with — the first
 * question moved up, or the last moved down.
 */
export async function moveQuestion(question: TestQuestion, direction: 'up' | 'down'): Promise<boolean> {
  const targetPosition = direction === 'up' ? question.position - 1 : question.position + 1;
  if (targetPosition < 1) return false;

  return db.transaction(async (tx) => {
    const [neighbour] = await tx
      .select()
      .from(testQuestions)
      .where(and(eq(testQuestions.testId, question.testId), eq(testQuestions.position, targetPosition)))
      .limit(1);
    if (!neighbour) return false;

    await tx.update(testQuestions).set({ position: -1 }).where(eq(testQuestions.id, question.id));
    await tx.update(testQuestions).set({ position: question.position }).where(eq(testQuestions.id, neighbour.id));
    await tx.update(testQuestions).set({ position: targetPosition }).where(eq(testQuestions.id, question.id));
    return true;
  });
}

/* -- Rows to a paper ------------------------------------------------------- */

/**
 * One stored question as an authoring draft.
 *
 * The casts are the reconciliation the schema's `jsonb` types stand in for.
 * They are safe in one direction only: everything written through
 * `parseQuestionInput` was rebuilt from the closed vocabulary in
 * `testInput.ts`, so a row cannot hold an operation the builders do not know.
 * A row written by hand, or by a future migration, is not covered — which is
 * exactly why the write path validates rather than trusting its caller.
 */
export function draftFromRow(row: TestQuestion): QuestionDraft {
  const base = {
    number: row.position,
    topic: row.topic,
    difficulty: row.difficulty,
    instruction: { en: row.instructionEn, hi: row.instructionHi },
    solution: { en: row.solutionEn, hi: row.solutionHi },
    marks: row.marks,
  };

  if (row.subject === 'word') {
    const content = row.content as WordContentRow;
    return {
      ...base,
      subject: 'word',
      lines: content.lines,
      scope: content.scope,
      operations: row.operations as WordOperation[],
    };
  }

  const content = row.content as ExcelContentRow;
  return {
    ...base,
    subject: 'excel',
    // The grid is stored, the workbook is built — so an edit to the sheet is
    // an edit to cells an admin can still see, not to a snapshot no form can
    // open again.
    workbook: workbookFromGrid(content.grid, content.startingView),
    operations: row.operations as ExcelOperation[],
  };
}

/**
 * A stored paper as the attempt the player renders.
 *
 * The point of the whole feature: what comes out is an ordinary `ExamAttempt`,
 * indistinguishable from `SEED_ATTEMPT`, so every screen that already renders
 * one renders this without knowing it came from a database.
 */
export function attemptFromTest(
  test: Test,
  questions: TestQuestion[],
  candidateName = 'Candidate',
): ExamAttempt {
  return buildAttempt({
    candidateName,
    subject: test.subject,
    sectionName: test.sectionName,
    durationSeconds: test.durationMinutes * 60,
    questions: questions.map(draftFromRow),
  });
}

/**
 * Every published paper, as the rows the candidate-facing tables render.
 *
 * The mock tables showed thirty fictional papers numbered 1–30 out of
 * `seedDashboard.ts`. These are the real ones, in the order they were written.
 *
 * The score, accuracy, rank, time and date columns come back empty, and that is
 * honest rather than unfinished: there is no `attempts` table, so nothing
 * anywhere knows whether a candidate has sat a paper or what they scored.
 * Inventing a number for those columns would be the one thing worse than a dash.
 *
 * `mockNumber` is the row's position in this list, not an id — it is what the
 * table prints as "Mock 1" and uses as a key. Once a schedule exists it becomes
 * the candidate's own numbering.
 */
export async function publishedTestRows(): Promise<MockSummary[]> {
  const rows = await db
    .select({
      test: tests,
      questionCount: count(testQuestions.id),
      totalMarks: sum(testQuestions.marks),
    })
    .from(tests)
    .innerJoin(exams, eq(tests.examId, exams.id))
    .leftJoin(testQuestions, eq(testQuestions.testId, tests.id))
    .where(eq(tests.status, 'published'))
    .groupBy(tests.id)
    .orderBy(asc(tests.createdAt));

  return rows.map(({ test, questionCount, totalMarks }, index) => {
    const questions = Number(questionCount ?? 0);

    return {
      mockNumber: index + 1,
      paperName: `${test.name} · ${questions} Q${questions === 1 ? '' : 's'}`,
      // Published and not yet sat. Nothing here knows any more than that.
      state: 'available' as const,
      maxScore: Number(totalMarks ?? 0),
      mockType: test.subject,
      questionCount: questions,
      dateLabel: `${test.durationMinutes} min`,
    };
  });
}

/**
 * The paper a candidate gets when they have not named one.
 *
 * "Today's test" is the oldest published test of the subject they asked for.
 * Not a schedule — there is no calendar table, and the dashboard's mock
 * calendar is still fixture data (`src/dashboard/seedDashboard.ts`) — but a
 * deterministic stand-in for one, so every existing Start button lands on an
 * authored paper instead of the hardcoded sample. Replacing this with a real
 * per-candidate schedule is a `tests`-to-calendar join and touches nothing
 * else: the rest of the player only ever sees the `ExamAttempt` that comes
 * out of `attemptFromTest`.
 *
 * Oldest rather than newest on purpose: the paper a candidate is shown should
 * not change under them because an admin wrote another one this morning.
 *
 * Null when no test of that subject has been published yet, which is what a
 * fresh database looks like — `/exam` falls back to the sample paper rather
 * than showing a candidate an error about content that does not exist.
 */
export async function todaysTest(subject: TestSubject): Promise<Test | null> {
  const [test] = await db
    .select()
    .from(tests)
    .where(and(eq(tests.subject, subject), eq(tests.status, 'published')))
    .orderBy(asc(tests.createdAt))
    .limit(1);

  return test ?? null;
}

/**
 * A paper ready to be sat: the attempt, its identity, and the id marking needs.
 *
 * One function because the three always travel together — the instructions
 * screen shows the identity over the attempt, and the submit route has to mark
 * the same paper the candidate was given, selected server-side from this id
 * rather than from anything the browser sends.
 */
export interface LoadedPaper {
  testId: string;
  slug: string;
  attempt: ExamAttempt;
  questions: TestQuestion[];
  identity: { testName: string; tagline: string; maximumMarks: number; qualifyingMarks: number };
}

export async function loadPaper(test: Test, candidateName?: string): Promise<LoadedPaper | null> {
  const questions = await questionsForTest(test.id);
  // A paper with no questions is not a paper. Better to fall back to the sample
  // than to open a timed sitting with an empty question palette.
  if (questions.length === 0) return null;

  return {
    testId: test.id,
    slug: test.slug,
    attempt: attemptFromTest(test, questions, candidateName),
    questions,
    identity: paperIdentityFor(test, questions),
  };
}

/**
 * The paper a request is asking for: the named one, else today's, else none.
 *
 * `slug` is what the URL carries, so a candidate who bookmarked a paper gets
 * that paper. Anything unrecognised falls through to today's rather than
 * erroring — a stale link should open something, not a 404.
 */
export async function paperFor(
  { slug, subject }: { slug?: string | null; subject: TestSubject },
  candidateName?: string,
): Promise<LoadedPaper | null> {
  if (slug) {
    const named = await getTestBySlug(slug);
    if (named) return loadPaper(named, candidateName);
  }

  const today = await todaysTest(subject);
  return today ? loadPaper(today, candidateName) : null;
}

/** What the instructions and result screens call the paper — the `PAPER` of `src/exam/result.ts`, per test. */
export function paperIdentityFor(
  test: Test,
  questions: TestQuestion[],
): { testName: string; tagline: string; maximumMarks: number; qualifyingMarks: number } {
  return {
    testName: test.name,
    tagline: test.tagline ?? 'Your Progress Brings You Closer to Success',
    // Summed from the questions, never stored: a total typed into a form is a
    // total that goes stale the next time a question's marks change.
    maximumMarks: questions.reduce((total, question) => total + question.marks, 0),
    qualifyingMarks: test.qualifyingMarks,
  };
}
