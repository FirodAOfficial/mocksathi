CREATE TABLE "word_doc_papers" (
	"test_id" uuid PRIMARY KEY NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "word_doc_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"test_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"topic" text NOT NULL,
	"difficulty" "question_difficulty" DEFAULT 'Easy' NOT NULL,
	"marks" integer DEFAULT 1 NOT NULL,
	"instruction_en" text NOT NULL,
	"instruction_hi" text NOT NULL,
	"solution_en" text[] DEFAULT '{}' NOT NULL,
	"solution_hi" text[] DEFAULT '{}' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "word_doc_questions_position_unique" UNIQUE("test_id","position")
);
--> statement-breakpoint
ALTER TABLE "word_doc_papers" ADD CONSTRAINT "word_doc_papers_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_doc_questions" ADD CONSTRAINT "word_doc_questions_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;