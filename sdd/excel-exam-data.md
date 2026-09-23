# Excel exam data and marking — how it actually works

What is stored for an Excel question, what a candidate's answer *is*, where both live, and exactly
how a submission is decided right or wrong. Not a proposal: everything below was read out of the
code on the branch it was written from, and every claim names the file it came from. `sdd/word-exam-data.md`
is a draft of a data model that does not exist yet; this one describes the one that does.

Read this before changing anything in `src/exam/marking/sheet/`, `src/server/marking/`,
`src/db/testInput.ts`, or the `ExcelOperation` union. The skill `.claude/skills/excel-exam-data/`
exists to keep it true.

## The one-paragraph version

An Excel question stores **the sheet the candidate starts from** (a grid of strings) and **what the
question asks them to do** (a list of `ExcelOperation`). It does *not* store the answer. The worked
answer shown after the paper closes and the answer key the submission is marked against are both
**derived from that same operations list**, so a question cannot be marked against something other
than what it asked. A candidate's answer is the whole workbook they ended with, as a
`WorkbookSnapshot`. Marking flattens both the submission and the starting workbook into a canonical
form and checks every criterion; a question scores **all its marks or none**.

## 1. Two papers, two sources of key

There are two ways an Excel paper reaches a candidate, and they differ only in where the questions
and the key come from.

| | Sample/fixture paper | Authored paper |
| --- | --- | --- |
| Questions | `src/exam/excelSeedAttempt.ts` (`EXCEL_SEED_ATTEMPT`, 15 questions, 50 marks) | `test_questions` rows, via `attemptFromTest` (`src/db/tests.ts`) |
| Answer key | `src/server/marking/excelQuestionBank.ts` — hand-written `SheetCriterion` lists | `rubricsFor` → `excelRubricFor` (`src/server/marking/rubricFromOperations.ts`) — derived from the question's own operations |
| Selected by | `subject=excel` with no `testId` | `testId` in the submission body |
| Recorded in `test_attempts` | **No** (`testId: null`) | Yes |

Both are chosen **server-side** in `src/app/api/attempts/submit/route.ts`. The client sends
`subject` and `testId` and nothing else that could influence a score — not the questions, not the
marks, not the starting workbook.

`db/seeds/sample-papers.sql` (optional, never run by `npm run db:migrate`) inserts the same 15
Excel questions as real `tests` rows under the slug `excel-practical-sample`, which is the only way
the authored path has real Excel content today. No migration creates an Excel paper.

## 2. How an Excel question is stored

### 2.1 The rows

`tests` (`src/db/schema.ts`) — one row per paper: `subject` is the enum `word | excel`, plus
`name`, `slug` (unique), `sectionName` (defaults to `Spreadsheet` for Excel — `src/db/testInput.ts`),
`durationMinutes`, `qualifyingMarks`, `status` (`draft | published`).

`test_questions` — one row per question. The scalar columns are what every question has whatever
application it is sat in:

| Column | Type | Excel meaning |
| --- | --- | --- |
| `position` | int | 1-based question number. Unique per test (`test_questions_position_unique`) — two questions numbered 7 would put the palette, the key and the result screen into disagreement. |
| `subject` | enum | Must equal the test's, checked on write in `src/db/tests.ts`, not by a constraint. |
| `topic`, `difficulty`, `marks` | text/enum/int | `marks` is what an all-or-nothing question awards. |
| `instruction_en` / `instruction_hi` | text | What the candidate reads. |
| `solution_en` / `solution_hi` | text[] | The ribbon route, shown only after the paper closes. |
| `content` | jsonb | The starting sheet. `ExcelContentRow`. |
| `operations` | jsonb | What the question asks for. `ExcelOperation[]`. |

### 2.2 `content` — the starting sheet

```jsonc
{
  "subject": "excel",
  "grid": {                              // one array per row, one string per cell
    "en": [["Student ID", "Name", "Course", "Fee"], ["101", "Rahul", "CCC", "5000"]],
    "hi": [["छात्र आईडी", "नाम", "कोर्स", "शुल्क"], ["101", "Rahul", "CCC", "5000"]]
  },
  "startingView": { "showGridlines": false, "showHeadings": false }   // optional
}
```

Three things about this shape are load-bearing:

- **Strings, not typed cells.** The grid is what an admin typed into a form, so it round-trips into
  a form that can open it again. It becomes values on read, not on write — see `cellValueOf`
  (`src/exam/authoring/excel.ts`): `/^-?\d+(?:\.\d+)?$/` becomes a number, `TRUE`/`FALSE` become
  booleans, `''` becomes `null`, everything else stays text. **This is a different and much narrower
  parser than the one the live editor uses** (`parseCellInput`, `src/spreadsheet/model/parseInput.ts`,
  which reads dates, times, percentages and currency). A starting sheet therefore cannot contain a
  date; a candidate typing one into it can.
- **Only the labels may differ between languages.** Numbers, layout and every cell address must be
  identical, because one answer key marks both. `parseExcelContent` enforces nothing here beyond
  substituting the English grid when the Hindi one is empty — the invariant is a convention, not a
  check.
- **`startingView` is written only when something is off.** `parseExcelContent` emits it only if
  `startingGridlines === false` or `startingHeadings === false`; the default view is absence.

### 2.3 `operations` — what the question asks for

The closed vocabulary is `ExcelOperation` in `src/exam/authoring/types.ts`. Eight kinds, and there
is no ninth anywhere — the admin parser, the model answer and the answer key are each a total switch
over this union, so adding a member breaks all three until they are updated. That is the guard rail.

| `kind` | Payload | Asks for |
| --- | --- | --- |
| `merge` | `range`, `across?`, `centre?` | Merge; Merge Across (per row); Merge & Center (`centre` adds the centring) |
| `style` | `range`, `style: Partial<CellStyle>` | Any cell formatting — including `numberFormat`, which is **not** a kind of its own |
| `outsideBorder` | `range`, `color?` | The perimeter only, which is not All Borders |
| `values` | `cells: { row, col, value?, formula? }[]` | Typed values and/or formulas |
| `columnWidth` | `col`, `width` (CSS px) | A widened column |
| `freeze` | `rows`, `columns` | Frozen panes |
| `view` | `showGridlines?`, `showHeadings?` | Gridlines/headings shown or hidden |
| `printArea` | `range \| null` | Set or clear the print area |

### 2.4 The write path, and every limit on it

`POST /api/admin/tests/[id]/questions` → `parseQuestionInput` → `parseExcelContent` +
`parseOperations` → `excelOperationOf` (all in `src/db/testInput.ts`).

Nothing from the request is stored as it arrived: every operation is **rebuilt** field by field from
the closed vocabulary, so a row cannot hold an operation the builders do not know. One bad operation
fails the whole question rather than being dropped — a question silently missing what it asked for
would be marked against a key that no longer matches its own instruction.

| Limit | Value | Where |
| --- | --- | --- |
| `MAX_GRID_ROWS` | 200 | `src/db/testInput.ts` |
| `MAX_GRID_COLUMNS` | 50 | " |
| `MAX_CELL_LENGTH` | 500 chars | " |
| `MAX_OPERATIONS` | 25 per question | " |
| `MAX_ANSWER_CELLS` | 500 per `values` operation | " |
| `columnWidth.width` | 1–2000 | `excelOperationOf` |
| `fontSize` | 1–409 | `styleOf` |
| `numberFormat` | trimmed, ≤ 100 chars | `styleOf` |
| Colours | `#rrggbb` via `colourOf` | " |

The grid is trimmed to its occupied rectangle (trailing blank rows, then trailing blank columns), so
the blank rows a form adds cost nothing.

### 2.5 The read path

`draftFromRow` (`src/db/questionRow.ts`) turns a row into an `ExcelQuestionDraft`:
`workbookFromGrid(content.grid, content.startingView)` builds a `WorkbookSnapshot` per language, and
`operations` is cast to `ExcelOperation[]` — safe only because the write path rebuilt it.

`buildExcelQuestion` (`src/exam/authoring/excel.ts`) then produces the `ExcelQuestion` the player
renders: the starting workbook per language, plus `modelAnswer` from `excelModelAnswer(operations)`.
The model answer is a `WorkbookAnswer` (`src/exam/types.ts`) — cells, styles, merges, columns,
frozen, view, printArea — and it is **applied to the starting workbook on the review screen**
(`modelWorkbookSnapshot`, `src/exam/modelWorkbook.ts`) rather than stored, so it cannot drift from
the data the candidate was given.

`modelAnswer` ships to the browser. That is deliberate and safe: it is what the instruction already
says to do. What counts as correct is decided server-side, against the key.

## 3. How a submitted answer is stored

### 3.1 What an answer is

```ts
export type AnswerPayload = JSONContent | WorkbookSnapshot;   // src/exam/types.ts
```

For Excel it is the entire workbook the candidate ended with — `WorkbookSnapshot`
(`src/spreadsheet/model/snapshot.ts`):

```ts
interface CellSnapshot { row; col; value: CellValue; formula?: string; style?: CellStyle }
interface SheetSnapshot { name; cells; rows; columns; merges; frozen; view; printArea }
interface WorkbookSnapshot { sheets: SheetSnapshot[] }
```

- **Styles are inlined by value, never by `styleId`.** An id indexes one `StyleRegistry` and means
  nothing to another workbook; `workbookFromSnapshot` re-interns on the far side.
- **A formula cell carries both.** `formula` is the source text, `value` is its *last computed
  result*. This matters for marking — see §4.6.
- `MAX_SNAPSHOT_CELLS` is 20,000 across the whole workbook (`snapshotWorkbook` throws
  `SnapshotTooLargeError`), and the submit route caps the whole request body at 2 MiB.

### 3.2 When it is captured

`useQuestionWorkbooks` (`src/spreadsheet/useQuestionWorkbooks.ts`) binds the sheet to the selected
question and holds two rules:

- Moving to another question **banks the current one first**, so coming back finds it as it was.
- A workbook equal to the one the question started from is **cleared, not saved**
  (`snapshotsEqual` against a freshly round-tripped starting snapshot). That is what makes
  "attempted" derived from the answers map rather than a flag that could disagree with the screen.

### 3.3 What is sent

`SubmitPayload` (`src/exam/submitAttempt.ts`) → `POST /api/attempts/submit`:

```jsonc
{ "answers": { "7": { "sheets": [...] } },   // by question number; missing = unattempted
  "subject": "excel", "testId": "uuid|null", "language": "en|hi",
  "timePerQuestion": { "7": 42 }, "totalTimeSeconds": 512 }
```

### 3.4 Where it lands

`test_attempts` (`src/db/schema.ts`), written by `recordAttempt` (`src/db/attempts.ts`) — **only for
an authored paper**; the fixture paper has no `tests` row to attach a score to.

One row per `(user, test)`, upserted on `test_attempts_user_test_unique`. A resit **overwrites**
`score`, `result` and `answers`; `attemptCount` is the one column that accumulates
(`attempt_count + 1` inside the same `UPDATE`, so two concurrent resubmissions cannot undercount).

| Column | Holds |
| --- | --- |
| `result` | the whole `ExamResult` verbatim, so "View Submission" renders what marking produced without re-marking |
| `answers` | `Record<number, AnswerPayload>` — the workbooks themselves, for the "your answer" side of the review |
| `score`, `max_score`, `accuracy_pct` | mirrors of `result.you`, so the mocks list sorts without unpacking JSON |
| `language` | which language's starting workbook to replay |

The criteria never cross back to the browser. The submit route returns `result` only — the key stays
on the server.

## 4. How a submission is marked

### 4.1 The chain

```
POST /api/attempts/submit
  ├─ paper = paperForTest(testId) ?? paperFor(subject)      // server-side, never from the request
  ├─ validateQuestionBank(attempt, rubrics, maximumMarks)   // 500 PAPER_INVALID if marks don't add up
  └─ markAttempt(attempt, rubrics, submission, reference, SHEET_MARKER, identity)
        └─ per question: markQuestion(...)
              ├─ SHEET_MARKER.project(answer)      → flattenWorkbook(submitted snapshot)
              ├─ SHEET_MARKER.start(question, lang)→ flattenWorkbook(question.workbook[lang])
              └─ evaluateSheetCriterion(c, submitted, start) for every criterion
```

`SubjectMarker` (`src/exam/marking/markAttempt.ts`) is the seam: marking a paper is the same job
whichever application it was sat in, and only three things differ — how an answer becomes something
comparable, where the starting state comes from, and what a criterion means.

**The starting workbook comes from the question, never from the submission.** Otherwise a candidate
could post a starting state that makes their answer correct.

### 4.2 The scoring rule

`markQuestion`: **every criterion must pass, or the question scores zero.** There is no partial
credit. The per-criterion results still come back so the candidate is told which step they missed —
the feedback is per-criterion even though the score is not.

Three outcomes: `unattempted` (no answer in the map), `correct` (all criteria passed, awards
`question.marks`), `incorrect` (anything else). A question with **no rubric** is reported as
`incorrect` with `Marking unavailable`, so a mis-authored paper is visible rather than generous.

Accuracy is over questions *attempted*, not the whole paper (`markAttempt`): leaving one blank is
not the same as getting it wrong.

### 4.3 Canonicalisation — what differences are not differences

`flattenWorkbook` / `canonicalStyle` (`src/exam/marking/sheet/flattenWorkbook.ts`) projects both
sides into one shape, so a comparison answers "does this sheet look the same", not "was it built the
same way":

- Falsy formatting is **dropped**: `bold: false` is the absence of formatting, so a candidate who
  bolds and unbolds equals one who never touched it.
- Colours are lowercased; font families trimmed.
- `numberFormat: 'General'` is dropped — General is the absence of a format.
- Zero `indent` and zero `textRotation` are dropped.
- Borders keep only the edges that exist, with lowercased colours.
- **Anything not in `canonicalStyle`'s list is dropped entirely**, including `quotePrefix`. A cell
  whose text was forced with a leading apostrophe marks identically to one that holds the same text
  without — correct, since the value is already a string and the sheet looks the same.
- Cells are keyed by the same packed integer the model uses (`cellKey`), so a marking lookup costs
  what a rendering lookup costs.

### 4.4 The criteria

`SheetCriterion` (`src/exam/marking/sheet/criteria.ts`), evaluated by `evaluateSheetCriterion`
(`.../evaluate.ts`). Every branch returns a `detail` naming the cell that failed, because "wrong"
without "where" teaches nothing.

| `kind` | Passes when | Notes |
| --- | --- | --- |
| `cellValue` | every targeted cell holds one of `equals` | `tolerance` for computed numbers |
| `cellFormula` | the cell has a formula, calls `usesFunction`, equals `equals`, evaluates to `resultEquals` | each part optional; all present are checked |
| `styled` | every targeted cell carries every named style property | `anyOf` allows alternatives for **one** property |
| `numberFormat` | every targeted cell uses one of the named formats | missing format reads as `General` |
| `cellSeries` | the target's cells, in reading order, hold `values` | cell count must match exactly; `formula.required` also demands a formula |
| `outsideBorder` | perimeter cells carry their edge **and interior cells carry none** | this is what tells Outside Borders from All Borders |
| `merged` | a merge with exactly that range exists | |
| `columnWidth` | width within `atLeast`/`atMost` | derived keys use `atLeast`: dragging a column lands *near* a width, never on it |
| `frozen` | frozen rows and columns both match | |
| `sheetView` | gridlines/headings match those named | |
| `printArea` | print area equals the range, or is unset when `null` | |
| `unchanged` | nothing changed outside the exemptions | §4.5 |

Comparison rules worth knowing before you write a question:

- **Text is compared trimmed and case-insensitively** (`valuesMatch`) — "Total " is not a wrong
  answer about the word.
- **Formulas are compared with whitespace removed and upper-cased** (`normaliseFormula`), so
  `=sum(b2:b7)` equals `=SUM(B2:B7)`.
- `usesFunction` is a `\bNAME\s*\(` match, case-insensitive — it does not care where in the formula
  the call sits.
- Targets: `range` resolves to **every address in it, occupied or not** (formatting an empty cell is
  a real thing to ask for); `column` and `sheet` resolve to what exists **in either workbook**, so a
  cell the candidate emptied is still looked at — deleting content is not a way to pass.

### 4.5 `unchanged` — the criterion that makes the paper strict

Every rubric ends with it, in both the hand-written bank and the derived one. It is not boilerplate:
doing what was asked *and* something else is a wrong answer, because the question tested one named
operation.

`checkUnchanged` sweeps **every cell either workbook holds** and compares content and style, then
columns, rows, merges, frozen panes, view and print area. An `SheetExemption` licenses exactly one
kind of difference, and `style` names the properties — so a question that asks for bold exempts
`bold` and nothing more, and an extra fill still fails.

In the derived key, each operation contributes its positive criterion **and** the exemption that
licenses precisely that change (`excelPiece`, `src/server/marking/rubricFromOperations.ts`):

| Operation | Licenses |
| --- | --- |
| `merge` | `content` (merging empties the covered cells) + `merges`, plus `horizontalAlignment` when `centre` |
| `style` | exactly the properties named in `style` |
| `outsideBorder` | `borders` on the range |
| `values` | `content` **and `numberFormat`** on each named cell, one exemption per cell rather than a bounding box |
| `columnWidth` | that column |
| `freeze` / `view` / `printArea` | `frozen` / `view` / `printArea` |

The `numberFormat` licence on `values` is there because **typing is what changes the format**:
entering `23/09/2026` or `50%` makes the cell a date or a percentage, in this editor
(`parseCellInput`) as in Excel. Without the licence, every correct answer to a question that asks
for a date to be typed in would fail the closing criterion. The hand-written
`EXCEL_QUESTION_BANK` does **not** carry that licence, because none of its `values` questions asks
for anything that formats itself — if one ever does, it needs the same exemption.

### 4.6 Traps that are real today

- **A formula is marked on its cached value.** `resultEquals` and `cellSeries` compare
  `cell.value`, which the snapshot carries as the formula's last computed result. A formula written
  correctly but never calculated does not pass — which is the honest answer, since the sheet does
  not show the right number — but it means the formula engine having failed to load looks like a
  wrong answer.
- **`contentEqual` compares values with `===`,** not with `valuesMatch`. The "nothing changed"
  sweep is therefore exact where the positive criteria are lenient.
- **A derived key exempts by cell, not by shape.** Scattered `values` cells get one exemption each,
  so the cells between them stay protected.
- **`anyOf` covers one property.** A question naming two colours a candidate might substitute cannot
  express both.
- **The fixture paper is never recorded.** A submission with no `testId` is marked and returned but
  writes no `test_attempts` row, so it cannot appear in the mocks list or the dashboard.

## 5. The invariant to protect

`src/server/marking/excelQuestionBank.ts` and `src/server/marking/rubricFromOperations.ts` both open
with `import 'server-only'`. They hold the answers. An accidental import from a client component
must fail the build rather than quietly ship the marking scheme to every candidate's browser;
`src/exam/marking/serverSafety.test.ts` walks the import graph below them to keep it that way.

A second invariant, weaker but just as load-bearing: **a question's worked answer and its answer key
are two readings of one `operations` list.** `src/server/marking/rubricFromOperations.test.ts`
asserts it directly — for every question in both sample papers, the model answer must *pass* the key
derived from the same operations, and the untouched starting workbook must *fail* it.
