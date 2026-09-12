CREATE TABLE "email_verification_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_verification_codes_user_created_idx" ON "email_verification_codes" USING btree ("user_id","created_at");--> statement-breakpoint
-- Hand-added: drizzle-kit generates the column but not this backfill.
--
-- Every existing account predates verification, so all of them have a null
-- `email_verified_at`. `requireVerifiedUser` sends a null straight to
-- /verify-email — so without this line, shipping the gate bounces every
-- current user, the admin included, out of the dashboard on their next
-- request. Only accounts created after this migration start unverified.
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;
