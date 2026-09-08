import 'server-only';
import { and, asc, desc, eq, notInArray } from 'drizzle-orm';
import { db } from './client';
import { isUniqueViolation } from './pgErrors';
import { enrollments, exams, type Exam } from './schema';

/**
 * Exam registrations — reads and writes for the profile page's "My exams"
 * card. Every write goes through here, which is what lets "only one primary
 * enrollment per user" be enforced in code (a transaction that unsets the
 * old one before setting the new one) rather than needing a DB-level
 * partial unique index.
 */

export interface EnrollmentWithExam {
  id: string;
  isPrimary: boolean;
  exam: Exam;
}

export async function enrollmentsForUser(userId: string): Promise<EnrollmentWithExam[]> {
  const rows = await db
    .select({ id: enrollments.id, isPrimary: enrollments.isPrimary, exam: exams })
    .from(enrollments)
    .innerJoin(exams, eq(enrollments.examId, exams.id))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.isPrimary), asc(exams.name));

  return rows;
}

/** Every published exam — the signup form's exam picker, before there's a user to filter against. */
export async function publishedExams(): Promise<Exam[]> {
  return db.select().from(exams).where(eq(exams.status, 'published')).orderBy(asc(exams.name));
}

/** Published exams the user isn't already registered for — the "add an exam" picker. */
export async function availableExamsForUser(userId: string): Promise<Exam[]> {
  const registered = await db.select({ examId: enrollments.examId }).from(enrollments).where(eq(enrollments.userId, userId));
  const registeredIds = registered.map((row) => row.examId);

  return db
    .select()
    .from(exams)
    .where(registeredIds.length > 0 ? and(eq(exams.status, 'published'), notInArray(exams.id, registeredIds)) : eq(exams.status, 'published'))
    .orderBy(asc(exams.name));
}

export type RegisterResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' | 'NOT_PUBLISHED' | 'ALREADY_REGISTERED'; detail: string };

export async function registerForExam(userId: string, examId: string): Promise<RegisterResult> {
  const [exam] = await db.select({ status: exams.status }).from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) return { ok: false, code: 'NOT_FOUND', detail: 'No such exam.' };
  if (exam.status !== 'published') return { ok: false, code: 'NOT_PUBLISHED', detail: 'This exam is not open for registration.' };

  const existing = await enrollmentsForUser(userId);
  try {
    await db.insert(enrollments).values({ userId, examId, isPrimary: existing.length === 0 });
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, code: 'ALREADY_REGISTERED', detail: 'Already registered for this exam.' };
    throw error;
  }
}

export type UnregisterResult = { ok: true } | { ok: false; code: 'NOT_FOUND'; detail: string };

export async function unregisterFromExam(userId: string, examId: string): Promise<UnregisterResult> {
  return db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.examId, examId)))
      .returning({ isPrimary: enrollments.isPrimary });

    if (!removed) return { ok: false, code: 'NOT_FOUND' as const, detail: 'Not registered for this exam.' };

    if (removed.isPrimary) {
      // Keep a primary exam set whenever possible, so the topbar picker
      // (PortalShell) always has something to show.
      const [next] = await tx
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(eq(enrollments.userId, userId))
        .orderBy(asc(enrollments.createdAt))
        .limit(1);
      if (next) await tx.update(enrollments).set({ isPrimary: true }).where(eq(enrollments.id, next.id));
    }

    return { ok: true };
  });
}

export type SetPrimaryResult = { ok: true } | { ok: false; code: 'NOT_FOUND'; detail: string };

export async function setPrimaryExam(userId: string, examId: string): Promise<SetPrimaryResult> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.examId, examId)))
      .limit(1);
    if (!target) return { ok: false as const, code: 'NOT_FOUND' as const, detail: 'Not registered for this exam.' };

    await tx.update(enrollments).set({ isPrimary: false }).where(and(eq(enrollments.userId, userId), eq(enrollments.isPrimary, true)));
    await tx.update(enrollments).set({ isPrimary: true }).where(eq(enrollments.id, target.id));
    return { ok: true };
  });
}
