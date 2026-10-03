CREATE TABLE "benchmark_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"schedule" text DEFAULT '0 * * * *' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"min_cohort_size" integer DEFAULT 3 NOT NULL,
	"exclude_empty_attempts" boolean DEFAULT true NOT NULL,
	"exclude_staff_attempts" boolean DEFAULT true NOT NULL,
	"full_rebuild_hours" integer DEFAULT 24 NOT NULL,
	"rebuild_requested" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone,
	"computed_through" timestamp with time zone,
	"last_full_rebuild_at" timestamp with time zone,
	"running_since" timestamp with time zone,
	"last_run_started_at" timestamp with time zone,
	"last_run_finished_at" timestamp with time zone,
	"last_run_status" text,
	"last_run_mode" text,
	"last_run_trigger" text,
	"last_run_rows_scanned" integer,
	"last_run_rows_changed" integer,
	"last_run_tests_updated" integer,
	"last_run_duration_ms" integer,
	"last_run_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "benchmark_settings_singleton" CHECK ("benchmark_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "test_benchmarks" (
	"test_id" uuid PRIMARY KEY NOT NULL,
	"cohort_size" integer DEFAULT 0 NOT NULL,
	"aggregate" jsonb NOT NULL,
	"best" jsonb,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_attempts" ADD COLUMN "benchmark_contribution" jsonb;--> statement-breakpoint
ALTER TABLE "benchmark_settings" ADD CONSTRAINT "benchmark_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_benchmarks" ADD CONSTRAINT "test_benchmarks_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "test_attempts_updated_at_idx" ON "test_attempts" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "test_attempts_test_id_idx" ON "test_attempts" USING btree ("test_id");--> statement-breakpoint
ALTER TABLE "benchmark_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "test_benchmarks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "benchmark_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
