ALTER TABLE "subscriptions" ALTER COLUMN "plan_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "plan";