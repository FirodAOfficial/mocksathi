import 'server-only';
import { eq } from 'drizzle-orm';
import type { GoogleUserInfo } from '@/auth/google';
import { normalizeEmail } from '@/auth/validation';
import { db } from './client';
import { isUniqueViolation } from './pgErrors';
import { users, type User } from './schema';

export interface GoogleAuthResult {
  user: User;
  /** True only for a brand-new row — the caller uses this to decide whether to run signup's best-effort steps (default-plan subscribe), never on an existing account: that would silently downgrade someone already on a paid plan back to free. */
  isNewUser: boolean;
}

/**
 * Finds the `users` row for a verified Google sign-in, linking or creating
 * one as needed. `googleId` is the real join key on repeat sign-ins (Google's
 * `sub`, stable forever); email is only used to link a *first* Google
 * sign-in to an account that already exists from email/password signup —
 * safe specifically because Google itself already verified the email
 * (`profile.email_verified`), which the caller must check before calling
 * this.
 *
 * `profile.email` is run through the same `normalizeEmail` (trim + lowercase)
 * that signup/login use before it ever touches a query. Google's own emails
 * are lowercase in practice, but that's not a guarantee this app controls —
 * comparing an unnormalized value here against `users.email` (always stored
 * normalized) would miss an existing account on a casing mismatch and create
 * a second row for the same real-world email, which is exactly the
 * uniqueness `users.email` is supposed to guarantee.
 */
export async function findOrCreateUserByGoogle(profile: GoogleUserInfo): Promise<GoogleAuthResult> {
  const email = normalizeEmail(profile.email);

  const [byGoogleId] = await db.select().from(users).where(eq(users.googleId, profile.sub)).limit(1);
  if (byGoogleId) return { user: byGoogleId, isNewUser: false };

  const [byEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (byEmail) {
    const [linked] = await db
      .update(users)
      .set({
        googleId: profile.sub,
        // Only fills in a *missing* photo — never overwrites one the user
        // already has, which could be a photo they uploaded themselves after
        // signing up with email/password (`POST /api/profile/avatar`).
        ...(byEmail.avatarUrl ? {} : { avatarUrl: profile.picture ?? null }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, byEmail.id))
      .returning();
    return { user: linked ?? byEmail, isNewUser: false };
  }

  try {
    const [created] = await db
      .insert(users)
      .values({
        email,
        name: profile.name,
        googleId: profile.sub,
        passwordHash: null,
        avatarUrl: profile.picture ?? null,
      })
      .returning();
    if (!created) throw new Error('Could not create the account.');
    return { user: created, isNewUser: true };
  } catch (error) {
    // A concurrent request won the race — either another first-time sign-in
    // for the same Google account, or a password signup for the same email
    // landing between this function's own two lookups above. Either way, the
    // loser re-reads (and, in the email case, still links) rather than
    // failing the request over a benign timing collision.
    if (!isUniqueViolation(error)) throw error;

    const [nowByGoogleId] = await db.select().from(users).where(eq(users.googleId, profile.sub)).limit(1);
    if (nowByGoogleId) return { user: nowByGoogleId, isNewUser: false };

    const [nowByEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (nowByEmail) {
      const [linked] = await db
        .update(users)
        .set({
          googleId: profile.sub,
          ...(nowByEmail.avatarUrl ? {} : { avatarUrl: profile.picture ?? null }),
          updatedAt: new Date(),
        })
        .where(eq(users.id, nowByEmail.id))
        .returning();
      return { user: linked ?? nowByEmail, isNewUser: false };
    }

    throw error;
  }
}
