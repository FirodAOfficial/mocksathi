import { date, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
