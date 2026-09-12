import { boolean, date, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

/**
 * Database schema, source of truth for the migrations in `db/migrations/`.
 *
 * Ids are generated in the application (`crypto.randomUUID()`), not by the
 * database, so no Postgres extension (`pgcrypto`/`uuid-ossp`) is required —
 * one less thing a fresh local database has to have enabled.
 */

export const USER_ROLES = ['student', 'admin', 'support'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const userRoleEnum = pgEnum('user_role', USER_ROLES);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  /**
   * Node `crypto.scrypt`, encoded as `scrypt:N:r:p:<salt>:<hash>` — see
   * `src/auth/password.ts`. Null for a Google-only account (`googleId` set
   * instead) — `POST /api/auth/login` checks for that and gives a clear
   * "sign in with Google" error rather than calling `verifyPassword` on it.
   */
  passwordHash: text('password_hash'),
  /** Google's stable `sub` claim (`src/auth/google.ts`) — the join key on repeat Google sign-ins, not email. */
  googleId: text('google_id').unique(),
  name: text('name').notNull(),
  /**
   * A public URL — either Google's own photo (`GoogleUserInfo.picture`,
   * captured once and never overwritten by a later Google sign-in, so it
   * can't clobber a photo the user uploaded themselves afterward) or one
   * uploaded via `POST /api/profile/avatar` (Supabase Storage, `src/utils/
   * supabase/admin.ts`). Null shows initials instead (`initialsFor`).
   */
  avatarUrl: text('avatar_url'),
  /** `admin` can manage exams (`/dashboard/admin/*`); `support` is reserved, not enforced anywhere yet. */
  role: userRoleEnum('role').notNull().default('student'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const sessions = pgTable('sessions', {
  /**
   * SHA-256 hex digest of the session token, not the token itself — the
   * cookie holds the raw token, so a leak of this table alone (a backup, a
   * read-only replica) cannot be replayed as a valid session.
   */
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export const EXAM_STATUSES = ['draft', 'published', 'archived'] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];
export const examStatusEnum = pgEnum('exam_status', EXAM_STATUSES);

/**
 * A recruitment/entrance exam a candidate might be preparing for — SSC CGL,
 * IBPS PO, and so on. Generic on purpose: this is reference/listing data
 * (dates, links, eligibility), not the mocks or questions for it, which stay
 * separate concerns.
 */
export const exams = pgTable('exams', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  /** URL-friendly, e.g. "ssc-cgl-2025". Unique so a future `/exams/:slug` page has a stable address. */
  slug: text('slug').notNull().unique(),
  /** Free text on purpose ("SSC", "Banking", "Railway", ...) — not an enum, so a new category never needs a migration. */
  category: text('category'),
  organiserName: text('organiser_name').notNull(),
  organiserWebsite: text('organiser_website'),
  /** The official notification / exam details, in the admin's own words. */
  description: text('description'),
  /** Link to the official notification document (usually a PDF). */
  notificationUrl: text('notification_url'),
  /** Where a candidate actually applies. */
  registrationUrl: text('registration_url'),

  formSubmissionStartDate: date('form_submission_start_date'),
  registrationStartDate: date('registration_start_date'),
  /** The last date to register — the figure candidates actually care about. */
  registrationLastDate: date('registration_last_date'),
  examDate: date('exam_date'),
  examEndDate: date('exam_end_date'),
  admitCardDate: date('admit_card_date'),
  resultDate: date('result_date'),

  qualificationRequirement: text('qualification_requirement'),
  ageLimitMin: integer('age_limit_min'),
  ageLimitMax: integer('age_limit_max'),
  /** Text, not a number: fee usually varies by category ("₹100 Gen / Free SC-ST-PwD"). */
  applicationFee: text('application_fee'),
  totalVacancies: integer('total_vacancies'),
  examMode: text('exam_mode'),

  /** `draft` exams are only visible in the admin list, not (once it exists) any public/candidate one. */
  status: examStatusEnum('status').notNull().default('draft'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Exam = typeof exams.$inferSelect;
export type NewExam = typeof exams.$inferInsert;

/**
 * A candidate's registration for an exam — the "exams registered" the
 * profile page manages. "Only one primary" is enforced in application code
 * (`src/db/enrollments.ts`, in a transaction), not a DB constraint: a
 * partial unique index would do it too, but every write already goes
 * through that one module, so the extra DB-level guarantee wasn't worth the
 * added migration complexity.
 */
export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('enrollments_user_exam_unique').on(table.userId, table.examId)],
);

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;

export const SUBSCRIPTION_STATUSES = ['active', 'expired', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);

/**
 * A plan an admin has defined — what it costs, how long it lasts, how many
 * mocks it allows, what it advertises. Exactly one plan is `isDefault`: the
 * one a brand-new signup is placed on automatically (see
 * `src/app/api/auth/signup/route.ts`) and the one `currentPlanForUser`
 * (`src/db/plans.ts`) falls back to for a user with no `subscriptions` row
 * at all. "Only one default" is enforced in code, same reasoning as
 * `enrollments`' "only one primary" — every write goes through
 * `src/db/plans.ts`, so a DB-level partial unique index wasn't worth it.
 */
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  /** Whole rupees. 0 for the free plan. */
  priceInInr: integer('price_in_inr').notNull().default(0),
  /** Null means the plan never expires (the free plan, typically). */
  durationDays: integer('duration_days'),
  /** Null means unlimited mock attempts. */
  mockLimit: integer('mock_limit'),
  /** Admin-authored bullet points, shown as-is on the upgrade page. */
  features: text('features').array().notNull().default([]),
  isDefault: boolean('is_default').notNull().default(false),
  /** Highlighted as "Most Popular" on the upgrade page. At most one in practice, not DB-enforced — purely cosmetic, unlike `isDefault`. */
  isPopular: boolean('is_popular').notNull().default(false),
  /** An inactive plan is hidden from the upgrade page and can't be newly chosen, but existing subscribers on it are untouched. */
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

/**
 * A user's current subscription state — one row per user (`userId` unique),
 * not a history log. A renewal or plan change updates this row in place;
 * tracking past subscriptions would need a separate events/history table,
 * not asked for yet. No payment gateway is wired up: choosing a plan on
 * `/dashboard/subscription` activates it directly (`src/db/plans.ts`,
 * `subscribeUserToPlan`) — there is no payment step to integrate yet, so the
 * page says so rather than claiming "secure payment" it doesn't do.
 */
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  // No onDelete: deliberately NO ACTION (Postgres default) — a plan with
  // active subscribers on it can't be deleted out from under them. The
  // admin plans UI only supports deactivating (`isActive`), not deleting.
  planId: uuid('plan_id')
    .notNull()
    .references(() => subscriptionPlans.id),
  status: subscriptionStatusEnum('status').notNull().default('active'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  /** Null means no expiry (the free plan, or an admin-granted comp). */
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export const TEST_SUBJECTS = ['word', 'excel'] as const;
export type TestSubject = (typeof TEST_SUBJECTS)[number];
export const testSubjectEnum = pgEnum('test_subject', TEST_SUBJECTS);

export const QUESTION_DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];
export const questionDifficultyEnum = pgEnum('question_difficulty', QUESTION_DIFFICULTIES);

/**
 * One paper a candidate sits in a sitting — the middle of `exams` > `tests` >
 * `test_questions`.
 *
 * A test belongs to exactly one exam, because that is what makes it findable:
 * a candidate prepares for SSC CGL and is shown the papers written for it. It
 * is all Word or all Excel, never a mixture, for the same reason `ExamAttempt`
 * carries one `subject` — the candidate sits a Word practical or a spreadsheet
 * practical, and the shell branches once rather than per question.
 *
 * The fixtures in `src/exam/seedAttempt.ts` and `excelSeedAttempt.ts` are the
 * shape this replaces. They stay for now: they are what the player renders
 * today, and `attemptFromTest` (`src/db/tests.ts`) produces the same
 * `ExamAttempt` from these rows, through the same builders.
 */
export const tests = pgTable('tests', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  examId: uuid('exam_id')
    .notNull()
    .references(() => exams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** URL-friendly, e.g. "ssc-cgl-word-practical-1". Unique so a future `/exam?test=:slug` has a stable address. */
  slug: text('slug').notNull().unique(),
  subject: testSubjectEnum('subject').notNull(),
  description: text('description'),
  /** What the instructions screen calls the one section the paper has. */
  sectionName: text('section_name').notNull().default('Section 1'),
  /** Shown under the test name on the instructions screen, like `PAPER.tagline`. */
  tagline: text('tagline'),
  /** Minutes here, seconds on `ExamAttempt` — a form asks for minutes, the clock counts seconds. */
  durationMinutes: integer('duration_minutes').notNull().default(15),
  /**
   * The pass mark. Not derived from the questions' marks: a paper can be
   * marked out of 50 and pass at 20, and which it is, is the author's call.
   */
  qualifyingMarks: integer('qualifying_marks').notNull().default(0),
  /** `draft` tests are only visible in the admin list; publishing is what offers one to a candidate. */
  status: examStatusEnum('status').notNull().default('draft'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Test = typeof tests.$inferSelect;
export type NewTest = typeof tests.$inferInsert;

/**
 * One question of one test.
 *
 * The columns are the fields every question has whatever it is sat in — what
 * the admin list, and any later "questions by topic" report, need to read
 * without unpacking JSON. The two `jsonb` columns hold what differs by
 * subject:
 *
 * - `content` is what the candidate starts from: a Word passage's lines, or a
 *   spreadsheet's grid of cells.
 * - `operations` is what the question asks them to do, in the vocabulary of
 *   `src/exam/authoring/types.ts` — *not* the model answer it produces. The
 *   model answer is derived on read, which is what stops a question and its
 *   worked answer from describing different tasks, and is what an answer key
 *   for authored papers would be derived from too.
 *
 * Neither is queried by the database, only by the builders, so a column each
 * rather than a table each: normalising a passage into rows and a model answer
 * into criteria would buy nothing but joins.
 */
export const testQuestions = pgTable(
  'test_questions',
  {
    id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    testId: uuid('test_id')
      .notNull()
      .references(() => tests.id, { onDelete: 'cascade' }),
    /** 1-based, and what the candidate sees as the question number. */
    position: integer('position').notNull(),
    /**
     * Matches the test's own subject, checked on write (`src/db/tests.ts`)
     * rather than by a constraint — Postgres has no cheap way to enforce a
     * child column equals its parent's. Denormalised so a question row builds
     * into an `ExamQuestion` without needing its test alongside it.
     */
    subject: testSubjectEnum('subject').notNull(),
    /** What the question exercises — "Character Formatting", "Merge & Center". */
    topic: text('topic').notNull(),
    difficulty: questionDifficultyEnum('difficulty').notNull().default('Easy'),
    marks: integer('marks').notNull().default(1),
    instructionEn: text('instruction_en').notNull(),
    instructionHi: text('instruction_hi').notNull(),
    /** The ribbon route, one step per element. Shown after the paper closes, never during. */
    solutionEn: text('solution_en').array().notNull().default([]),
    solutionHi: text('solution_hi').array().notNull().default([]),
    content: jsonb('content').$type<QuestionContentRow>().notNull(),
    operations: jsonb('operations').$type<QuestionOperationRow[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // Two questions numbered 7 would put the palette, the answer key and the
  // result screen into disagreement about which one was answered.
  (table) => [unique('test_questions_position_unique').on(table.testId, table.position)],
);

export type TestQuestion = typeof testQuestions.$inferSelect;
export type NewTestQuestion = typeof testQuestions.$inferInsert;

/**
 * The `jsonb` payloads, named here only so the columns above are typed.
 *
 * Structurally the authoring types, and deliberately declared rather than
 * imported: `schema.ts` is read by `drizzle.config.ts`, which runs outside
 * Next's module resolution and cannot follow a `@/` path. `src/db/tests.ts` is
 * where the two are reconciled, and the assignment is checked there against
 * the real types rather than asserted here.
 */
export interface WordContentRow {
  subject: 'word';
  /** One paragraph per line, per language. */
  lines: { en: string[]; hi: string[] };
  /** `'all'`, or the character range of the one line the question names. */
  scope: 'all' | { from: number; to: number };
}

export interface ExcelContentRow {
  subject: 'excel';
  /** One array per row, one string per cell, per language. Only labels may differ. */
  grid: { en: string[][]; hi: string[][] };
  /** A non-default starting view, for a question whose task is to restore it. */
  startingView?: { showGridlines?: boolean; showHeadings?: boolean };
}

export type QuestionContentRow = WordContentRow | ExcelContentRow;

/** One `WordOperation` or `ExcelOperation`; see `src/exam/authoring/types.ts`. */
export interface QuestionOperationRow {
  kind: string;
  [key: string]: unknown;
}
