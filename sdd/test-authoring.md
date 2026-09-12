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

## Not built yet

**Sitting an authored paper.** `/exam`, the two shells and `POST /api/attempts/submit` still load
the fixtures; nothing reads a `tests` row into the player. The pieces that exist for it are
`attemptFromTest` (rows → `ExamAttempt`) and `paperIdentityFor` (rows → the `PAPER` shape the
instructions and result screens take). What remains:

1. `/exam?test=<slug>` loads the test and passes `attemptFromTest` to `InstructionsScreen`.
2. `WordShell` / `SpreadsheetShell` take the attempt as a prop instead of defaulting to the fixture
   in the store.
3. `POST /api/attempts/submit` accepts a test id and selects the paper from it rather than from the
   two-value subject enum — and needs an answer key, which means deriving `QuestionRubric` /
   `SheetQuestionRubric` from the stored `operations`. That derivation is the substantive piece; it
   is a server-only module, and the operation vocabulary was designed so each entry maps to its
   positive criterion plus its exemption in the closing `unchanged`.

Deliberately left out of this pass because it is a change to the player and the marking path, not
to authoring, and worth doing as its own piece of work rather than half-wired into this one.
