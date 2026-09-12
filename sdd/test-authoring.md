# Test Enigma — authoring papers in the admin panel

Third level of the content hierarchy, below the `exams` table from `sdd/exams.md`:

```
Exam        SSC CGL 2025                      — what a candidate is preparing for (exists)
└─ Test     Word Practical — Paper 1          — one paper, sat in one sitting        (new)
   └─ Question  "Make the paragraph bold"     — a passage/sheet plus one task        (new)
```

Until now the only papers that existed were the two fixtures, `src/exam/seedAttempt.ts` (Word) and
`src/exam/excelSeedAttempt.ts` (Excel) — TypeScript files, editable only by a developer with a
deploy. This makes writing a paper an admin job, backed by the database, without changing what the
exam player renders: a stored test comes out of `attemptFromTest` as an ordinary `ExamAttempt`,
indistinguishable from `SEED_ATTEMPT`.

## The central decision: a question states its *operation*, not its answer

The fixtures write each question's model answer out by hand beside its instruction:

```ts
instruction: { en: 'Make the paragraph bold and underline it.', … },
modelAnswer: whole([{ type: 'bold' }, { type: 'underline' }]),
```

Two facts, kept in step by whoever edits the file. That is fine for a fixture a developer maintains
and hopeless for a form an admin types into: nothing would notice a question that says "make it
bold" shipping a worked answer that italicises it, and the candidate would be shown the wrong thing
on the review screen.

So an authored question stores what it *asks for*, and the answer is derived:

```ts
instruction: …,
operations: [{ kind: 'bold' }, { kind: 'underline' }],   // stored
modelAnswer: wordModelAnswer(operations, scope)          // derived on read
```

`WordOperation` and `ExcelOperation` (`src/exam/authoring/types.ts`) are a closed vocabulary of the
ribbon actions the papers actually exercise — bold, highlight with a colour, font, size, alignment,
line spacing, indent; merge, format, outside border, values and formulas, column width, freeze,
gridlines/headings, print area. Between them they express all thirty questions in the two existing
fixtures, which is how the vocabulary was sized.

The same field is what an answer key for authored papers would be derived from when marking them
arrives — one statement of what the question asks, feeding both the worked answer and the marking,
rather than three places to keep in agreement.

## Decisions

- **The builders are shared with the fixtures, not copied from them.** `src/exam/authoring/` now
  owns `passageDocument`, `wholeParagraph`, `characterRange`, `steps`, `sheetOf`, `range`,
  `formats` and the model-answer derivation; `seedAttempt.ts` and `excelSeedAttempt.ts` import them
  and were rewritten to declare operations instead of model answers. Both fixtures produce
  byte-identical model answers to before — `markAttempt.test.ts` and `markExcelAttempt.test.ts`,
  which mark every question against the existing answer keys, pass untouched. That is the whole
  point: an authored paper and the sample papers are built by one piece of code, so "Merge &
  Center" cannot mean one thing in a fixture and another in a form.
- **`tests` and `test_questions`, with two `jsonb` columns.** Everything a list or report needs is
  a real column (topic, difficulty, marks, position, subject, both instructions, both solutions);
  what differs by application is JSON. `content` is what the candidate starts from — a passage's
  lines, or a sheet's grid of cells — and `operations` is what they are asked to do. Neither is
  ever queried by the database, only by the builders, so normalising a passage into rows and a
  model answer into criteria would buy joins and nothing else.
- **The grid is stored, not the workbook.** An Excel question stores `string[][]` per language and
  `workbookFromGrid` builds the `WorkbookSnapshot` on read. Storing the snapshot would be storing a
  form's output in a shape no form can open again.
- **Positions are 1..n with no gaps, maintained server-side.** They are the numbers the palette,
  the instructions screen and the result all call the questions, so a paper that jumps from 6 to 8
  reads as a question that failed to load. Deleting closes the gap; reordering is a swap with a
  neighbour (`PATCH { move: 'up' | 'down' }`), never a position the client names — a client that
  could name one could give two questions the same number. The swap goes through position `-1`
  because `(test_id, position)` is unique and the intermediate state of a straight swap is not.
- **A paper's application is locked once it has questions.** Every question holds either a passage
  or a sheet, and the two shells are not interchangeable, so switching a Word paper to Excel would
  hand the spreadsheet fifteen questions with no sheet. `PUT /api/admin/tests/[id]` refuses with a
  reason (`SUBJECT_LOCKED`) rather than ignoring the change, and the form greys the picker out.
- **Operations are rebuilt, not stored as sent.** They are read back and executed, so
  `parseOperations` (`src/db/testInput.ts`) reconstructs every one field by field from the closed
  vocabulary: an unknown `kind` is a 400, a colour that is not `#rrggbb` is a 400, and a `style`
  keeps only the whitelisted `CellStyle` properties. One bad operation fails the whole question
  rather than being dropped — a question silently missing what it asked for would be marked against
  a key that no longer matches its own instruction, and the admin would never see it happen.
- **Hindi falls back to English.** A paper authored in English only is a real thing an admin does;
  making the Hindi instruction, solution, passage or sheet required would only get English typed
  into them. An empty Hindi box means "same as English", and the editor shows it empty again on the
  way back so the fallback does not look like duplicated text the admin wrote.
- **Admin-only, enforced twice**, same as exams and plans: `requireAdmin()` on every
  `/dashboard/admin/tests*` page *and* independently on every `/api/admin/tests*` route, since the
  API is reachable directly. A non-admin gets a 404, not a 403.
- **`src/db/tests.ts` is `server-only`.** Not to hide the questions — a candidate sitting the paper
  is shown them, and `ModelAnswer` is explicitly public — but because the answer key derived from
  the same `operations` must never be bundled for a client.

## What's built

- [x] `src/exam/authoring/` — `types.ts` (the operation vocabulary and the draft types), `word.ts`,
      `excel.ts`, `index.ts` (`buildQuestion`, `buildAttempt`). Exported, so the helpers the
      fixtures kept to themselves are now what an authored paper is built with too.
- [x] `src/exam/seedAttempt.ts` and `src/exam/excelSeedAttempt.ts` rewritten onto them — drafts now
      declare `operations` (plus a `scope` for the two line-addressed Word questions) and call
      `buildWordQuestion` / `buildExcelQuestion`. No behaviour change, proven by the existing
      marking suites.
- [x] `src/db/schema.ts` — `TEST_SUBJECTS` / `testSubjectEnum`, `QUESTION_DIFFICULTIES` /
      `questionDifficultyEnum`, the `tests` and `test_questions` tables (reusing `examStatusEnum`
      for a test's `draft` | `published` | `archived`). Migration
      `db/migrations/0008_safe_komodo.sql`.
- [x] `src/db/testInput.ts` — `parseTestInput`, `parseQuestionInput`, `parseOperations`, plus the
      size limits one admin request may store. Unit-tested in `src/db/testInput.test.ts`.
- [x] `src/db/tests.ts` — the queries, plus `draftFromRow`, `attemptFromTest` and
      `paperIdentityFor`, which are where stored rows become an `ExamAttempt`.
- [x] `POST /api/admin/tests`, `PUT|DELETE /api/admin/tests/[id]`,
      `POST /api/admin/tests/[id]/questions`,
      `PUT|PATCH|DELETE /api/admin/tests/[id]/questions/[questionId]`.
- [x] `/dashboard/admin/tests` — the Test Enigma list (`TestsListScreen`).
- [x] `/dashboard/admin/tests/new` and `/[id]/edit` — `TestForm`.
- [x] `/dashboard/admin/tests/[id]` — the paper's workbench: its figures, and `TestQuestionsPanel`
      with the question list and `QuestionEditor` opening in place. One screen rather than a page
      per question, because writing a paper is fifteen of these in a row.
- [x] "Test Enigma" nav item, admin-only, beside "Manage Exams".
- [x] `src/exam/authoring/authoring.test.ts` (28) and `src/db/testInput.test.ts` (27).
- [x] `tsc --noEmit`, `eslint` and `next build` clean.

## Update — sitting an authored paper

The player now reads its paper from `tests` rather than from the fixtures, and marks it against a
key derived from the same `operations` the question was written with.

### Which paper a candidate gets

`todaysTest(subject)` is the oldest **published** test of the subject asked for. Not a schedule —
there is no calendar table, and the dashboard's mock calendar is still fixture data — but a
deterministic stand-in, so `/exam` opens an authored paper instead of the hardcoded sample.
*Oldest*, not newest, so the paper a candidate is part-way through reading about does not change
because an admin published another one this morning.

`/exam?test=<slug>` names one explicitly and wins over today's. The slug is carried through the
instructions screen into `?test=` on the editor URL, rather than each page resolving "today's"
independently: between reading the instructions and pressing Start, a second resolution could
return a different paper, and the candidate would sit one whose duration and marks they never saw.

**With no published test of that subject, the sample paper stands in.** A fresh database has no
`tests` rows, and `/exam` working on one is what keeps the whole app runnable before an admin has
written anything. Which of the two it was never reaches a component: both arrive as an ordinary
`ExamAttempt`.

### The derived answer key

`src/server/marking/rubricFromOperations.ts` builds a `QuestionRubric` / `SheetQuestionRubric` from
a question's operations. Nobody is going to type a `Criterion` into an admin form, and if they
could, nothing would keep it in step with the instruction beside it — so the same field that
produces the model answer produces the key, and a paper cannot be marked against something other
than what it showed.

Each operation contributes its positive criterion *and* its entry in the closing `unchanged`, which
is the rule the papers are built on: doing what was asked **and** something else is a wrong answer,
because the question tested one named operation.

Two deliberate leniencies, both copied from the hand-written banks rather than invented:

- **Either of Office's two reds** (and two dark blues, two oranges) passes. Which one a candidate
  lands on in the palette is not what the question is testing.
- **A formula is checked by the function it calls**, not its exact text — `=sum(b2:b7)` is the same
  answer as `=SUM(B2:B7)`. Pure arithmetic like `=B2-C2` names no function, so it is held to the
  value it produces instead, which is what actually proves it works.

`rubricFromOperations.test.ts` is the load-bearing check: for all thirty questions in both sample
papers, the model answer the candidate is shown after the paper closes must **pass** the key those
same operations produce, and the untouched starting document must **fail**. The second half matters
as much as the first — a key that passed everything would satisfy the first half perfectly.

That test found a real bug in `outsideBorderStyles`: it emitted four overlapping edge strips, and
`StyleRegistry.derive` replaces `borders` wholesale rather than merging edges, so whichever strip
reached a corner second dropped the other's edge. The worked answer for an Outside Border question
showed A1 with a left edge and no top one. It now emits one entry per perimeter cell, carrying every
edge that cell needs at once.

### What the client may say

Two things, and they are both selectors, not content: `subject`, and `testId`. The questions, the
marks and the answer key are all re-loaded server-side from the id, so naming another paper marks
you against *that* paper's questions rather than awarding you its marks for these answers. A
`testId` naming a deleted paper falls back to the sample rather than 500ing mid-sitting.

### The mock tables list real papers

All Mocks (`/dashboard/mocks`) and the dashboard home's list are sourced from `publishedTestRows()`
— every published row in `tests`, oldest first — rather than from the thirty fictional mocks in
`seedDashboard.ts`. The Today's Mock card names the paper `/exam` would actually open, instead of a
fixture mock number sat above a list of real ones.

Score, accuracy, rank, time: all empty, for every row. That is honest rather than unfinished —
there is no `attempts` table, so nothing anywhere knows whether a candidate has sat a paper or what
they scored, and inventing a number for those columns would be the one thing worse than a dash.

Every row opens its own paper: `MockSummary.testSlug` carries the `tests` row it stands for, and
`startHrefFor` turns that into `/exam?subject=<skill>&test=<slug>`. The slug is what makes a Start
button meaningful — while the rows were fixture mocks they had nothing of their own to open, so
every button on the page would have led to the same paper, which is why none of them did.

A new `MockState`, `available`, marks a row published-but-not-sat, distinct from `today`, which
means "sit this one now" and brings the chip and the highlighted row with it. Nothing writes
`today` for an authored paper yet, because nothing schedules one.

**Any signed-in candidate may open any published paper.** There is no entitlement check on the exam
routes beyond `requireUser()`, and deliberately none elsewhere: who may sit what — by plan, by
enrolment, by schedule — is a product rule nobody has written yet, and a guess at one would be a
rule to unpick rather than a head start.

### The sample papers as data

`db/seeds/sample-papers.sql` inserts the two fixtures as real `tests` rows. It is a **seed, not a
migration**, and deliberately absent from `db/migrations/meta/_journal.json` so `db:migrate` never
picks it up: a migration has to run on every database or the code breaks against it, while thirty
questions of demo content is something most databases have no reason to want, and there would be no
way to decline it without editing history.

Generated from the fixtures under one check — rebuild the drafts from the generated rows, the way
`draftFromRow` does, and assert the paper equals `SEED_ATTEMPT` / `EXCEL_SEED_ATTEMPT` question for
question. The Excel questions had to be reversed out of built workbooks back into grids of strings,
which is exactly the step that could have silently lost a number's type.

### Still to come

- **Scheduling, and who may sit what.** Any candidate can open any published paper today, and
  "today's" is just the oldest one. A schedule joining a candidate to the papers they are meant to
  sit — and on which day — replaces `todaysTest` and decides which rows are locked, which is `today`,
  and which are out of plan. Nothing else has to change: the rest of the player only ever sees the
  `ExamAttempt` from `attemptFromTest`.
- **Admin deletes.** A test can be deleted from its workbench (`DeleteResource`), which cascades to
  its questions — the confirmation counts them and makes the admin type DELETE. An exam can be
  deleted only while nothing points at it: `enrollments.exam_id` and `tests.exam_id` both cascade, so
  `DELETE /api/admin/exams/[id]` refuses with a 409 naming what is in the way and points at
  Archived instead. Plans stay deactivate-only, which is the existing deliberate design
  (`subscriptions.plan_id` is `NO ACTION` so a plan with subscribers cannot be removed from under
  them).
- **Storing attempts.** A sitting is still marked and shown, never recorded — there is no `attempts`
  table, so the result screen is the only place a score exists.
