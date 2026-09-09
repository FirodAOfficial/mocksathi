import { boolean, date, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

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
  /** Node `crypto.scrypt`, encoded as `scrypt:N:r:p:<salt>:<hash>` — see `src/auth/password.ts`. */
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
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
