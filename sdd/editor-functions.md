# The function catalog — one vocabulary for the ribbon, the author and the marker

A *function* is one thing the editor can do and one thing a question can ask for: Bold, Underline
(wavy), Left indent 1.1", Replace "MSP" with "MRP". Before this, each one was spread over six places
that had no way of knowing about each other:

| Consumer | What it needed |
| --- | --- |
| The ribbon and dialogs | a command |
| The admin question form | a picker entry and its fields |
| `parseOperations` | a validation branch |
| The model answer | marks and attributes |
| The answer key | criteria and exemptions |
| Solution steps | a sentence |

Adding "underline, double" meant six edits, and nothing checked that they agreed. A question could
ship asking for one thing and marking another, and the only way to find out was a candidate losing
a mark.

## The decision

**A function declares itself once, in `src/editor/functions/catalog.ts`.** It says what it is
called, which ribbon group it belongs to, whether it formats characters or the block, what
parameters it takes, what the passage looks like once it has been applied, what must be true of the
submission, and what formatting it therefore licenses. Everything else reads that:

- the admin form builds its fields from `params` and groups its picker by `category`;
- `wordOperationOf` validates against the same `params` — a new function is accepted with no edit,
  and a `kind` that is not in the catalog is refused however plausible it looks;
- `characterMarks` / `paragraphAttrs` gather `answer` into the worked answer;
- `wordRubricFor` gathers `criteria` and `licences` into the key.

The property that buys: **what a question asks for, what the worked answer shows, and what the
candidate is marked against are three readings of one declaration.** They cannot drift.

The catalog is typed as one entry per member of `WordOperation`, so adding an operation without an
entry does not compile. That is the guard rail — not a convention anyone has to remember.

## Naming the text: selections

`src/editor/functions/selection.ts`. A question used to name its text as `'all'` or as two character
offsets someone had measured against the rendered page. Now it names it: the third word, the second
sentence, the fourth paragraph, a phrase, a phrase *wherever it appears*.

- **Stored, not resolved.** A selection is kept as what it says and resolved against the document
  being marked, which is what lets one answer key be correct for both languages a paper is offered
  in — "the third word" is a different character range in Hindi.
- **Resolved against text, never layout.** A selector cannot name a *rendered* line: where a line
  wraps depends on page width and font. Those questions still use character offsets, and still carry
  the warning they always did.
- **A selection that names nothing is refused when the question is saved**, not discovered at
  marking time. The admin form shows the words the selection lands on as it is typed.

## Questions with more than one step

`WordQuestionDraft.steps` — a list of `{ scope, operations }`. "Number the first, second and fourth
paragraphs" is three selections in one question; "replace the word, then bold it" is two steps on
the same text, in order. A single-step question keeps the old shape, and `stepsOf` reads either.

## Passages that start formatted

`WordQuestionDraft.initial`, in the same vocabulary. "Remove the blue from the second paragraph" is
only a question if the paragraph is blue to begin with, and "change this list to bullets" needs a
list to change. The starting formatting goes through the same renderer as the worked answer, so a
question cannot start in a state its own answer could not describe — and `unchanged` compares
against that same document.

## Two rules that had to bend

- **A question that rewrites the wording is not closed with "and nothing else changed."** That
  criterion compares the submission character by character against the starting document, which is
  exactly what a replacement breaks. Functions that rewrite text declare `rewritesText`, the rubric
  builder leaves `unchanged` out, and the replacement's own criteria carry the weight: the new word
  is there, the old one is gone.
- **Lengths are compared to the nearest pixel.** An indent asked for in inches and typed in
  centimetres lands a fifth of a pixel apart and rounds to one. Anything larger would start
  accepting indents that are visibly wrong, so the tolerance is exactly one pixel and only on
  lengths — a line-spacing multiplier or an alignment is still compared exactly.

## What is deliberately not here

- **Tables.** The model has cells, but no cell shading, no per-cell borders, no structural
  operations (adding a column), and no selector naming a row, a column or a cell.
- **Page-level settings.** Headers and footers, page numbers, watermark text and orientation, page
  borders, gutter margins. Some exist as view state in `uiStore.ts`, which the marker never sees;
  none are part of the submitted document.

Both are new *families* — a place in the document model, a projection, their own criterion kinds —
not new functions. Questions needing them cannot be authored or marked today, and the two efficiency
papers replace them with paragraph questions exercising the same ribbon groups, each saying what it
stands in for.

## Adding one

`.claude/skills/editor-functions/SKILL.md` is the procedure, and it is the file to read before
touching any of this.
