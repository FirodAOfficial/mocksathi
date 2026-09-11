# What data a Word exam needs — draft

A draft, not an implementation plan: what fields a real Word-efficiency mock paper would need to
be defined as data instead of hardcoded, before any schema/migration/admin-UI work starts. Prompted
by having only one paper today, entirely fixture (`src/exam/seedAttempt.ts` +
`src/server/marking/questionBank.ts`), with no way to add a second one without editing code.

## The current shape (what exists, split across two files)

One paper today, split in two for a real reason that must survive whatever replaces it:

- **`src/exam/seedAttempt.ts`** — public. Ships to the browser. Instructions, passages, solution
  steps, and a client-visible `modelAnswer` (what a *correct* document looks like, for the review
  screen). `WordShell` and the editor read only this.
- **`src/server/marking/questionBank.ts`** — `import 'server-only'`. Never bundled for the client.
  The actual marking rubric: what to check for and how many marks each check is worth. If this ever
  reached the browser, a candidate could read the answer key straight out of devtools.

Any real data model keeps this split. It is the single load-bearing security property of the whole
exam system (`.claude/skills/auth-security-review/SKILL.md` doesn't call it out today — it should
gain a line once this becomes real data, since "don't let the rubric reach the client" is exactly
the kind of invariant that skill exists to protect).

## Proposed data model

### Paper (top level)

One row = one sittable mock, e.g. "RSSB LDC — Mock 3".

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `examId` | FK -> `exams.id` | Which real-world exam this mock prepares for. Nullable at first if a paper can be generic/unassigned. |
| `testName` | text | Shown on the result screen header. Today: `PAPER.testName` ("Rajasthan Efficiency Test - 01"). |
| `tagline` | text | Cosmetic, shown under the test name. |
| `durationSeconds` | int | Today: `ExamAttempt.durationSeconds`, fixed at 10 minutes. |
| `maximumMarks` | int | Today: `PAPER.maximumMarks` (50) — must equal the sum of every question's `marks`, so this is arguably *derived*, not stored, once questions live in the same table. |
| `qualifyingMarks` | numeric | Today: `PAPER.qualifyingMarks` (12.5) — the pass/fail line on the result screen. |
| `languages` | `Language[]` | Today always `['en', 'hi']`. Every question's `instruction`/`passage`/`solution` must exist for every language the paper claims — that's a real-data invariant, not just a TypeScript type today. |
| `status` | `draft \| published` | So an admin can build a paper before candidates can sit it — mirrors `exams.published` on the metadata table. |

### Section

Today there's exactly one: `{ name: 'Word Processing', questions: [...] }`. Worth keeping as its
own level even with one section per paper today, since an Excel paper (or a mixed Word+Excel paper,
already implied by the dashboard's `mockType: 'mixed'`) needs more than one.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `paperId` | FK | |
| `name` | text | e.g. "Word Processing", "Excel Efficiency". |
| `sortOrder` | int | |

### Question (public — ships to the browser)

One row = one task. Today: `ExamQuestion` in `src/exam/types.ts`, authored via the `Draft` shape in
`seedAttempt.ts`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `sectionId` | FK | |
| `number` | int | 1-based, shown to the candidate. Could be derived from `sortOrder` instead of stored. |
| `topic` | text | e.g. "Character Formatting" — shown on the review screen, not to the candidate mid-exam. |
| `difficulty` | `Easy \| Medium \| Hard` | |
| `marks` | int | |
| `instruction` | `{ en: text, hi: text }` (per language in `languages`) | What the candidate is told to do. Never rendered inside the document itself (see the comment on `ExamQuestion.instruction` — this is deliberate: the instruction must stay outside the region under test). |
| `passage` | `{ en: JSONContent, hi: JSONContent }` | The starting document. Today built from a single paragraph of plain text via a `passage()` helper — real authoring needs to decide whether this stays plain-text-per-language (simple, but limits questions to one paragraph) or becomes real rich-text/JSON input (flexible, but needs an editor for admins to author it in, not a textarea). |
| `solution` | `{ en: text[], hi: text[] }` | Ribbon steps shown on the solutions screen after the paper closes. Teaching material, not the answer key — safe to keep public, unlike the rubric. |
| `modelAnswer` | see below | What the *correct* document looks like — public, since the instruction already implies it. |

`modelAnswer` (today, `ModelAnswer` in `types.ts`):

| Field | Type | Notes |
|---|---|---|
| `scope` | `'all'` \| `{ from: int, to: int }` | Whole first paragraph, or a character range within it (used by the two "underline the 2nd line" style questions). A character-range scope is fragile by construction — see "Open questions" below. |
| `marks` | `{ type: string, attrs?: object }[]` | Editor mark types applied (`bold`, `underline`, `highlight`, `fontFamily`, `fontSize`, `color`, ...). |
| `attrs` | `object` | Paragraph-level attributes (`textAlign`, `lineHeight`, `indentLeft`). |

### Rubric / answer key (server-only — never ships to the client)

Today: `QuestionRubric` in `src/exam/marking/criteria.ts`, populated per-question in
`questionBank.ts`, keyed by `number` back to the public question. This is the part a real data
model has to be most careful storing — it needs its own access path (a separate table an ordinary
authenticated query never joins into, same spirit as `server-only` today) so a bug in an API route
can't accidentally select it into a response meant for candidates.

| Field | Type | Notes |
|---|---|---|
| `questionId` | FK | |
| `criteria` | `Criterion[]` | An ordered list of checks; a question passes a criterion or doesn't, and marks accumulate per criterion (see `evaluateCriterion` / `markAttempt.ts` for how these actually get scored — out of scope for this draft). |

Each `Criterion` is one of three kinds today:

- **`marked`** — checks one editor mark is present on a `target` (e.g. "the paragraph is bold").
  Takes an optional `value` for marks that carry data (a font name, a colour — sometimes a list of
  acceptable values, like Word's two reds).
- **`blockAttr`** — checks a paragraph attribute (`align`, `lineHeight`, `indentLeft`) on a given
  block index.
- **`unchanged`** — checks nothing *else* changed beyond what's explicitly excepted. Every question
  in the bank today ends with one of these, because applying an extra, unasked-for format is treated
  as a wrong answer, not a bonus-marks right answer.

`target` (what a `marked`/`unchanged` criterion points at):

- `{ by: 'block', block: number }` — a whole paragraph by index.
- `{ by: 'range', block: number, from: number, to: number }` — a character range within one block.

### Reference / benchmark data

Used only by the result screen's comparison charts (`REFERENCE_TOPPER`, `REFERENCE_AVERAGE`,
`REFERENCE_TOPPER_TIMES`, `REFERENCE_AVERAGE_TIMES` in `src/exam/result.ts`) — a topper's and an
average candidate's score and per-question time, hardcoded today. Whether this stays
paper-editor-authored fixture data (an admin types in "what a topper scores"), or becomes something
computed from real attempts once enough candidates have sat a paper, is a real decision but not one
this draft needs to resolve — flagging it exists as a fourth kind of per-paper data, separate from
the three above, since a new paper needs *some* value here before its result screen means anything.

## Open questions this draft doesn't answer

- **Character-range targets are layout-fragile.** The existing comment on `SECOND_LINE` in
  `questionBank.ts` says this outright: the offsets are measured against a fixed page width and
  default font, with no automated way to re-measure (jsdom has no layout). Any new paper reusing
  "underline the 2nd line"-style questions inherits that fragility, or needs the measurement step
  turned into a real tool before authoring can scale past hand-editing constants.
- **Passage authoring format.** Plain text per language (today) vs. a real rich-text input. Plain
  text is simple and matches every question so far being "one paragraph, one operation" — but it
  caps what a question can ask (no tables, no multi-paragraph documents), which an Excel-style
  section will likely need something closer to a spreadsheet-shaped answer than paragraph marks/attrs
  anyway.
- **Is a paper immutable once someone has attempted it?** `enrollments`/`subscriptions` in this app
  already lean toward "one current row, updated in place" rather than history tables. A paper is
  different — editing `maximumMarks` or a rubric after candidates have real `ExamResult`s on record
  would retroactively change what their past attempt "should" have scored. Needs a real answer
  before a paper becomes editable after publishing, not just before.
- **Excel questions don't fit this shape at all.** Everything above (`ModelAnswer.scope`,
  `blockAttr`, `marked` targeting a paragraph) is Word-specific — a `ParagraphFormatting`-shaped
  answer. An Excel paper needs its own rubric vocabulary (cell ranges, formulas, formatting per
  cell), not a reuse of `Target`/`Criterion` as they exist today. This draft is scoped to "Word
  exam" per the ask; Excel is a separate draft once one exists.
- **Where authoring happens.** Nothing here assumes an admin UI, a JSON import, or hand-written
  migrations — that's an implementation decision for whenever this moves past draft.

## Explicitly out of scope for this draft

- Actual schema/migration (`src/db/schema.ts`, `db/migrations/`).
- An admin authoring UI (mirrors the exams/plans admin CRUD already built, but questions/rubrics are
  a much larger authoring surface than a plan's few fields).
- Multi-question-type support (MCQ, fill-in-the-blank) — everything above assumes the current
  "format this document" question shape only.
