-- Hand-added: fixes a drift the schema/migrations never introduced.
--
-- The live database had `email_verified_at DEFAULT now()` on `users`, set
-- directly (not through drizzle-kit — schema.ts and every prior migration
-- declare this column with no default). Since ~2026-09-12, that meant every
-- new INSERT silently filled it in, so `requireVerifiedUser` never saw a null
-- and no password signup ever reached /verify-email. Dropping the default
-- here restores the schema.ts contract: null unless set explicitly by
-- `confirmVerificationCode` or a Google sign-in.
ALTER TABLE "users" ALTER COLUMN "email_verified_at" DROP DEFAULT;
