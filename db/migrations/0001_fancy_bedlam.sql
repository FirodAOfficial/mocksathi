CREATE TYPE "public"."exam_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'admin', 'support');--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text,
	"organiser_name" text NOT NULL,
	"organiser_website" text,
	"description" text,
	"notification_url" text,
	"registration_url" text,
	"form_submission_start_date" date,
	"registration_start_date" date,
	"registration_last_date" date,
	"exam_date" date,
	"exam_end_date" date,
	"admit_card_date" date,
	"result_date" date,
	"qualification_requirement" text,
	"age_limit_min" integer,
	"age_limit_max" integer,
	"application_fee" text,
	"total_vacancies" integer,
	"exam_mode" text,
	"status" "exam_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'student' NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;