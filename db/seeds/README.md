# Optional seeds

SQL in this folder is **never run for you**. `npm run db:migrate` only applies the files listed in
`db/migrations/meta/_journal.json`, and nothing here is in it.

That is the distinction the folder exists to make: a *migration* has to run on every database or the
code breaks against it, so it is not optional and never should be. A *seed* is content — demo data,
fixtures, a worked example — that most databases have no reason to want. Putting content in
`db/migrations/` would force it onto every developer's machine, every preview environment and
production alike, and there would be no way to say no without editing history.

## `sample-papers.sql`

Inserts the two sample papers as real `tests` rows: the Word practical (15 questions, 50 marks,
10 minutes) and the Excel practical (15 questions, 50 marks, 15 minutes). These are the papers that
otherwise exist only as TypeScript fixtures in `src/exam/seedAttempt.ts` and
`src/exam/excelSeedAttempt.ts`, which `/exam` falls back to when nothing has been authored.

**Run it when** you want a working portal to click around — a fresh local database, or a demo — and
do not fancy typing thirty questions into Test Enigma first.

**Skip it when** the database already has real papers. It does no harm, but two sample papers will
sit in the candidate's mock list looking like the real thing.

It attaches them to the **oldest exam**, so there has to be one first. It is safe to run more than
once and safe on an empty database:

| State | What happens |
| --- | --- |
| No exam exists | Nothing. Raises a notice saying so. |
| Papers already present | Nothing. Raises a notice saying so. |
| Otherwise | Inserts both papers and their 30 questions. |

### Running it

Either of these, against the database you actually mean:

```bash
# psql, if you have it
psql "$MIGRATION_DATABASE_URL" -f db/seeds/sample-papers.sql

# or paste the file into the Supabase SQL editor / Drizzle Gateway
```

There is deliberately no npm script. Seeding is a decision, and a script named `db:seed` sitting
next to `db:migrate` invites being run without one.

### Undoing it

```sql
DELETE FROM tests WHERE slug IN ('word-practical-sample', 'excel-practical-sample');
```

`test_questions.test_id` cascades, so the questions go with them.

### Where it came from

Generated from the fixtures rather than typed by hand, under one check: rebuild the drafts from the
generated rows — the way `draftFromRow` does when the player loads them — and assert the paper they
build equals `SEED_ATTEMPT` / `EXCEL_SEED_ATTEMPT`, question for question. The Excel questions had
to be reversed out of built workbooks back into grids of strings, and a lost number type or label
would have shown up there rather than in front of a candidate.

Regenerate it only if the fixtures change *and* you want a fresh copy — and note that editing this
file does not change any database that already ran it.

> Already applied to the shared hosted database. If you are pointing at that one, you have these
> papers; running it again is a no-op.
