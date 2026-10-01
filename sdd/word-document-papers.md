# Word papers on one document

A second way to write a Word paper, beside the per-question flow in `sdd/test-authoring.md`.

| | Per-question (existing) | Single document (this) |
|---|---|---|
| Passage | one per question, typed as lines | one for the whole paper, typed in the real editor |
| Operation | picked from the catalog in a form | **performed** in the editor and detected |
| Candidate | a fresh document per question | one document for the whole sitting, any order |
| Marked on | the question's final document | only what changed while that question was open |
| Tables | `test_questions` | `word_doc_papers`, `word_doc_questions` |

## How it works

**Authoring** (`/author/<test id>`, `DocumentAuthoringShell`). The admin types the passage (with
any starting formatting) and saves it. Then, for each question: type the wording, topic,
difficulty, marks; perform the operation with the ribbon; save. The right panel shows the detected
operation live. On save the server rebuilds the *before* itself (passage + every stored question
replayed), detects the change against the document it was sent (`recordQuestion`), and stores the
detected `steps`. The browser's live reading is a preview, never an input.

**Detection** (`src/exam/document/detect.ts`) compares the two marking projections (`flatten`):
per character, every `RunFormatting` property; per paragraph, every `ParagraphFormatting` property
plus style and list kind. Runs of characters that took the same new value become a step; changes
on the same characters are grouped. Spaces at the edges are trimmed from what is *asked* but kept
in what is *licensed*. Refused: any change to the wording or paragraph structure, list-level
changes, no visible change, and anything replay cannot reproduce exactly (`faithful`).

**Replay** (`apply.ts`) puts steps back onto a document through the normalised model. No snapshot is
stored: the document question *k* is recorded on is `replay(passage, questions < k)`, and the
worked answer shown after the paper is `applySteps(passage, question k)`. Deleting a question
anywhere is therefore safe.

**Sitting** (`useSharedDocumentAnswers`). The passage is installed once. Leaving a question (or
saving, or the timeout) appends `{ question, document }` to a timeline if anything changed; each
visit gets a fresh undo history. Clear undoes the current visit only. The submission carries the
timeline; the server rebuilds each entry's before from the previous entry (the first from its own
copy of the passage), so a client cannot supply a flattering "before".

**Marking** (`documentMarker`, `documentRubricFor`). Per question: each detected change is a
criterion on the last visit's *after*; one `unchanged` must hold for every visit, licensing exactly
the detected changes. Doing another question's work while this one is open fails this one and
leaves the other unattempted — the question is "did you do *this* while *this* was open".

## What candidates are offered

`WORD_PAPERS_FROM_DOCUMENT_TABLES` (`src/db/tests.ts`, currently `true`): the mock lists
(`publishedTestRows` — dashboard and All Mocks) and "today's" Word paper (`todaysTest`, what a bare
`/exam` opens) take Word papers from `word_doc_questions` only. Per-question Word papers are no
longer offered, but still exist, still open by their own `?test=` link, keep their stored attempts,
and still appear in the admin list. Excel is unaffected. Set it to `false` to offer both again.

## Known limits

- **Overlapping questions.** Two questions setting the same property on the same text cannot both
  show a change in every order. The authoring screen warns (`overlap.ts`); it does not refuse.
- **One passage language.** Instructions and solutions are bilingual; the passage is not.
- **No reordering.** Position is also recording order. Candidates answer in any order anyway.
- **The passage locks** once a question exists — every question is offsets into its wording.
- **Text-changing questions** (find & replace) are not supported in this flow.

## Reverting

Nothing existing was altered in the database. To remove the flow: drop `word_doc_questions` and
`word_doc_papers` (migration `0017_word_document_papers`), delete `src/exam/document/`,
`src/db/documentPaper*.ts`, `src/server/marking/documentRubric.ts`,
`src/exam/marking/documentMarker.ts`, `src/editor/useSharedDocumentAnswers.ts`,
`src/state/sharedDocumentStore.ts`, `src/components/authoring/`, `src/app/author/`,
`src/app/api/admin/tests/[id]/document/`, `DocumentPaperPanel.tsx`, and the branches marked in
`tests.ts`, the submit route, the workbench, the submission page, the test edit page/route and
`WordShell.tsx`. `ExamAttempt.sharedDocument` and `WordQuestion.answerDocument` are optional and
unused by everything else.
