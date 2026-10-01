# Excel papers on one workbook

The Excel counterpart of `sdd/word-document-papers.md`, built the same way: the admin enters the
starting sheet once in the real spreadsheet and records each question by **performing** it; the
operation is **detected** from the workbook before and after and stored; candidates answer on one
shared workbook in any order; each question is marked only on what changed while it was open.

| | Per-question (existing, `sdd/excel-exam-data.md`) | Single workbook (this) |
|---|---|---|
| Starting sheet | a grid of strings per question | one workbook for the paper, entered in the spreadsheet |
| Operation | `ExcelOperation`s picked in a form | performed with the ribbon/formula bar, detected |
| Candidate | a workbook per question | one workbook for the sitting, any order |
| Tables | `test_questions` | `excel_doc_papers`, `excel_doc_questions` (migration `0018`) |

## How it works

**Authoring** — `/author/<test id>` renders `WorkbookAuthoringShell` for an Excel test with no
`test_questions` rows. It shares its list, form and requests with the Word screen
(`useAuthoringFlow`, `AuthoringPanels`). Routes: `PUT /api/admin/tests/[id]/workbook`,
`POST …/workbook/questions`, `PUT|DELETE …/workbook/questions/[questionId]`. The server rebuilds the
before (`workbookBefore` = start + earlier questions replayed) and detects from the sent after.

**Detection** — `src/exam/workbook/detect.ts`, on the marking projection (`flattenWorkbook`), first
sheet only:

| Step | From |
|---|---|
| `content` | a cell's value or formula changed — **a formula whose text is unchanged is never a change**, so a recalculated SUM is not recorded |
| `style` | one `canonicalStyle` property changed; grouped by value (borders: one step, values per cell); `licence` adds cells in the changed area that already had the value |
| `merge` | a merge added or removed |
| `column` / `row` | width/height or hidden changed |
| `freeze` / `view` / `printArea` | sheet settings |

Refused: sheets added/removed/renamed, any change on another sheet, nothing changed, more than 60
steps, or a change replay cannot reproduce (`faithfulWorkbook`). Inserting/deleting rows or columns
is not detected as such — it shows as many content changes — and the screen asks the admin not to.

**Replay** — `apply.ts` applies steps to a snapshot: the chain the admin records on, and each
question's worked answer (`ExcelQuestion.answerWorkbook`, preferred by `modelWorkbookSnapshot`).

**Sitting** — `useSharedWorkbookAnswers` (chosen by `ExamAttempt.sharedWorkbook` in
`SpreadsheetShell`): one workbook, a timeline entry per visit that changed something, fresh undo per
visit (`store.load`), Clear undoes the current visit only. The timeline is submitted; the server
rebuilds each before from its own starting workbook (`parseWorkbookTimeline` checks every snapshot's
shape first — `isWorkbookSnapshot`).

**Marking** — `workbookRubricFor` (`server-only`) + `workbookMarker`:

| Step | Criterion | Licence (`unchanged`) |
|---|---|---|
| typed values | `cellValue`, or one `cellSeries` for a run | `content` + `numberFormat` per cell |
| formula | `formulaLike` — same function if the admin's calls one, and **the same result as the admin's formula, both evaluated server-side on the candidate's own sheet** | as values |
| style | `cellProperty` per cell (absent for a removal; either of Office's two reds) | that property on the cells + licence |
| merge / unmerge | `merged` / `notMerged` | `merges`, `content` on the range |
| column / row | `columnWidth` / `rowSize` past the midpoint; `columnHidden` / `rowHidden` | that column / row |
| freeze, view, print area | `frozen`, `sheetView`, `printArea` | the matching flag |

`unchanged` must hold for every visit, ignoring formulas whose text did not change. The formula
engine (`loadFormulaEvaluator`) is loaded once per submission; if it cannot load, a formula is
compared by its normalised text instead.

The extra criterion kinds live in `WorkbookCriterion` in `workbookMarker.ts`, not in the shared
`SheetCriterion` union, so the per-question papers are untouched.

## Which papers candidates see

`EXCEL_PAPERS_FROM_WORKBOOK_TABLES` in `src/db/tests.ts` is **true**: the mock lists and "today's"
Excel paper take Excel papers from `excel_doc_questions` only. Per-question Excel papers are no longer
offered, but still exist, open by their own `?test=` link, keep their submissions, and appear in the
admin list. Set it to false to offer both again.

## Tested

`src/exam/workbook/workbookActions.test.ts` drives a real `WorkbookStore` through 30 actions (font
styles, font, size, colours, fill, alignment, wrap, indent, rotation, super/subscript, number formats,
outside/all borders, remove bold, no fill, merge & center, unmerge, typed values, a changed number,
SUM and arithmetic formulas, clear, column width, row height, freeze, gridlines, print area) — each
detected as the standard value, described, replayed, marked right in either answer order (including
a SUM answered after its inputs changed) and wrong for a near miss or an extra change.
`src/spreadsheet/useSharedWorkbookAnswers.test.ts` covers the sitting.

Not yet possible: hiding rows/columns (the spreadsheet has no command for it — detection and marking
already handle it), and anything on a second sheet.

## Reverting

Drop `excel_doc_questions` and `excel_doc_papers`; delete `src/exam/workbook/`,
`src/db/workbookPaper*.ts`, `src/server/marking/workbookRubric.ts`,
`src/exam/marking/sheet/workbookMarker.ts`, `src/spreadsheet/useSharedWorkbookAnswers*.ts`,
`src/components/authoring/WorkbookAuthoringShell.tsx`, `src/app/api/admin/tests/[id]/workbook/`, and
the Excel branches in `tests.ts`, the submit route, the author page, the workbench, the test edit
page/route and `SpreadsheetShell.tsx`.
