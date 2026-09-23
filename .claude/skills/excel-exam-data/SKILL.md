---
name: excel-exam-data
description: Change anything about how an Excel question is stored, authored, answered or marked — the ExcelOperation vocabulary, a SheetCriterion, the "nothing else changed" sweep, the grid/operations jsonb columns, the submitted WorkbookSnapshot, or how a typed entry becomes a cell value. Use when adding an Excel operation or criterion, changing cell-entry coercion or number formats, touching src/exam/marking/sheet/, src/server/marking/, src/db/testInput.ts, or when an Excel question marks a correct answer wrong. Also use to check that sdd/excel-exam-data.md still matches the code.
---

# Changing Excel question data or marking

`sdd/excel-exam-data.md` is the written-down truth about all of this: what is stored, what a
candidate's answer is, and exactly how it is marked. **Read it first** — it names every file
involved and every limit — and **update it in the same change**, because a document about a data
model that has moved on is worse than no document.

## The one rule everything here serves

> A question's **worked answer** and its **answer key** are two readings of *one* `operations` list.

They cannot disagree, because there is only one of them. Everything below exists to keep that true.
`src/server/marking/rubricFromOperations.test.ts` asserts it directly: for every question in both
sample papers, the model answer must *pass* the derived key, and the untouched starting workbook
must *fail* it. If a change breaks that test, the change is wrong, not the test.

The second rule: **`import 'server-only'` on anything holding answers.** `questionBank.ts`,
`excelQuestionBank.ts` and `rubricFromOperations.ts` all have it, and
`src/exam/marking/serverSafety.test.ts` walks the import graph below them. Never import one of those
from a client component, and never move an answer-bearing helper into a module a client can reach.

## Procedures

### A. Adding an `ExcelOperation`

The union in `src/exam/authoring/types.ts` is read by four total switches. Adding a member breaks
the build until all four are done — that is the guard rail, not an obstacle.

1. **`src/exam/authoring/types.ts`** — add the member. Name the fields as the *ribbon* names them,
   not as the engine stores them; the conversion is this layer's problem, not an author's.
2. **`src/exam/authoring/excel.ts` → `excelModelAnswer`** — what the worked answer shows.
3. **`src/server/marking/rubricFromOperations.ts` → `excelPiece`** — return both halves:
   - `criteria`: what must be true, with a `label` a candidate can act on ("A1:D1 is merged into one
     cell"), never an assertion name.
   - `exemptions`: exactly what this operation licenses changing, and nothing more. An exemption
     that is too wide silently turns off the "nothing else changed" criterion for that area.
4. **`src/db/testInput.ts` → `excelOperationOf`** — rebuild it field by field from the request.
   Never spread the raw object. Bound every number; clamp every string.
5. **`src/components/dashboard/admin/QuestionEditor.tsx`** — an operation nobody can author is dead
   code.
6. Add it to the operations table in `sdd/excel-exam-data.md` §2.3 and, if it licenses something new,
   to the exemptions table in §4.5.

### B. Adding or changing a `SheetCriterion`

1. `src/exam/marking/sheet/criteria.ts` — the union. Say in a comment what makes it *not* a variant
   of an existing kind (`outsideBorder` vs `styled` is the model).
2. `src/exam/marking/sheet/evaluate.ts` — the branch. Every failure returns a `detail` naming the
   cell, because "wrong" without "where" teaches nothing.
3. If the new criterion can be produced by an operation, wire it in `excelPiece` too.
4. Tests in `src/exam/marking/sheet/evaluate.test.ts`: one that passes, one that fails, and — if it
   involves formatting — one proving the closing `unchanged` criterion still catches an extra change.
5. Update the criteria table in `sdd/excel-exam-data.md` §4.4.

### C. Changing how a typed entry becomes a cell value

`src/spreadsheet/model/parseInput.ts` (`parseCellInput`) decides a cell's **value and its number
format together**. That makes it a marking change, not just an editor change:

- A new implied format means cells now differ in `numberFormat` after an entry the question asked
  for. Check that the `values` exemption in `excelPiece` still licenses it (it licenses
  `numberFormat` today, precisely for dates and percentages), and check whether
  `EXCEL_QUESTION_BANK` needs the same licence for any question whose expected value would now
  format itself.
- If the format is a new code, `formatCellValue` (`src/spreadsheet/model/format.ts`) must render it,
  and `canonicalStyle` (`src/exam/marking/sheet/flattenWorkbook.ts`) must decide whether it is a
  difference at all.
- `editText` in `src/spreadsheet/WorkbookStore.ts` has to give the entry back the way it went in.
  A cell whose formula bar shows something that re-commits to a *different* value is a bug the
  candidate finds with F2 and Enter.

Note that the authoring grid uses a **different, much narrower** parser — `cellValueOf` in
`src/exam/authoring/excel.ts` — deliberately: a starting sheet holds numbers, booleans and text, and
nothing that guesses. Do not unify them without deciding what an authored date should mean.

### D. When a correct Excel answer marks wrong

Work down this list; it is ordered by how often each one is the cause.

1. **The closing `unchanged` criterion.** Read its `detail` — it names the cell or the thing that
   changed. Almost always an exemption that is too narrow for a side effect of doing what was asked
   (a number format applied by typing, content moved out of merged cells).
2. **A formula's cached value.** `resultEquals` and `cellSeries` compare `cell.value`, the formula's
   last computed result. Not calculated means not correct.
3. **Canonicalisation.** `canonicalStyle` drops anything not in its list — if the criterion checks a
   property that is dropped, it can never pass.
4. **The starting workbook.** Marking starts from `question.workbook[language]`, never from the
   submission. A question whose two languages differ in anything but labels marks one of them wrong.
5. **The rubric source.** A fixture paper is marked by the hand-written `EXCEL_QUESTION_BANK`; an
   authored paper by the derived key. They are different code paths — fixing one does not fix the
   other.

## Keeping the document true

`sdd/excel-exam-data.md` states specific things that rot. After any change in this area, re-check:

| Section | Goes stale when |
| --- | --- |
| §1 table | a paper moves between fixture and authored, or a migration finally seeds an Excel paper |
| §2.3 operations table | `ExcelOperation` gains or loses a member |
| §2.4 limits table | any `MAX_*` in `src/db/testInput.ts` changes |
| §3.1 | `WorkbookSnapshot` or `MAX_SNAPSHOT_CELLS` changes |
| §3.4 | `test_attempts` gains a column, or the upsert rule changes |
| §4.3 | `canonicalStyle` starts or stops keeping a property |
| §4.4 criteria table | `SheetCriterion` changes |
| §4.5 exemptions table | `excelPiece` licenses something new |
| §4.6 traps | one of them is fixed — delete it rather than leaving it as a warning about nothing |

Check a claim against the code before repeating it. The document's whole value is that every line in
it was read out of the source rather than assumed, and one guessed sentence costs it that.
