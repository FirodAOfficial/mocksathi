import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Database schema, source of truth for the migrations in `db/migrations/`.
 *
 * Ids are generated in the application (`crypto.randomUUID()`), not by the
 * database, so no Postgres extension (`pgcrypto`/`uuid-ossp`) is required —
 * one less thing a fresh local database has to have enabled.
 */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  /** Node `crypto.scrypt`, encoded as `scrypt:N:r:p:<salt>:<hash>` — see `src/auth/password.ts`. */
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
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
