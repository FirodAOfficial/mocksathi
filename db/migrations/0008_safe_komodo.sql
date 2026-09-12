CREATE TYPE "public"."question_difficulty" AS ENUM('Easy', 'Medium', 'Hard');--> statement-breakpoint
CREATE TYPE "public"."test_subject" AS ENUM('word', 'excel');--> statement-breakpoint
CREATE TABLE "test_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"test_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"subject" "test_subject" NOT NULL,
	"topic" text NOT NULL,
	"difficulty" "question_difficulty" DEFAULT 'Easy' NOT NULL,
	"marks" integer DEFAULT 1 NOT NULL,
	"instruction_en" text NOT NULL,
	"instruction_hi" text NOT NULL,
	"solution_en" text[] DEFAULT '{}' NOT NULL,
	"solution_hi" text[] DEFAULT '{}' NOT NULL,
	"content" jsonb NOT NULL,
	"operations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_questions_position_unique" UNIQUE("test_id","position")
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"exam_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"subject" "test_subject" NOT NULL,
	"description" text,
	"section_name" text DEFAULT 'Section 1' NOT NULL,
	"tagline" text,
	"duration_minutes" integer DEFAULT 15 NOT NULL,
	"qualifying_marks" integer DEFAULT 0 NOT NULL,
	"status" "exam_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tests_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;