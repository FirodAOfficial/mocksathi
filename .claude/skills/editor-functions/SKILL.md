---
name: editor-functions
description: Add or change a Word formatting function — anything the ribbon can do and a question can ask for (bold, underline styles, indents, spacing, replacements, removals). Use when adding a ribbon control, a Font/Paragraph dialog field, a new formatting property, a new question topic, a new question type, or when a question's worked answer and its marking disagree — in either the per-question catalog flow or the single-document (detected-operation) flow.
---

# Adding an editor function

A *function* is one thing the editor can be asked to do and one thing a question can ask for —
Bold, Highlight green, Left indent 1.1 cm, Replace "contact" with "conversation". Every one of them
is declared once, in **`src/editor/functions/catalog.ts`**, and read from there by six consumers
that used to keep their own copy:

| Consumer | What it reads | Where |
| --- | --- | --- |
| The ribbon and dialogs | the command | `src/editor/ribbonActions.ts`, `src/components/ribbon/`, `src/components/dialogs/` |
| The admin question form | `params`, `label`, `category` | `src/components/dashboard/admin/QuestionEditor.tsx` |
| The request parser | `params` | `src/db/testInput.ts` (`wordOperationOf`) |
| The worked answer | `answer` | `src/exam/authoring/word.ts` → `src/exam/modelAnswerDocument.ts` |
| The answer key | `criteria`, `licences` | `src/server/marking/rubricFromOperations.ts` |
| Solution text and summaries | `describe` | wherever a step is listed |

**The rule this exists to enforce:** what a question asks for, what the worked answer shows, and
what the candidate is marked against are three readings of *one* declaration. They cannot drift,
because there is only one of them.

## The procedure

### 1. Add the operation to the vocabulary

`src/exam/authoring/types.ts`, the `WordOperation` union. Name the parameters as the *dialog* names
them, not as the editor stores them — `cm`, `points`, `style` — because an admin picks what Word's
box says and the conversion is this layer's problem.

```ts
| { kind: 'spaceAfter'; points: number }
```

The catalog is typed as one entry per member of that union, so **this step alone breaks the build**
until step 2 is done. That is the guard rail: there is no way to add an operation that nothing can
mark, or an entry for an operation nobody can author.

### 2. Declare it in the catalog

`src/editor/functions/catalog.ts`. Every field is load-bearing:

- **`category`** — which ribbon group it belongs to; the admin form groups its picker by this.
- **`level`** — `'character'` formats the selection, `'paragraph'` formats the whole block however
  the question was scoped, because Word cannot centre half a line.
- **`params`** — one `ParamSpec` per argument. The five shapes (`colour`, `number`, `enum`, `text`,
  `boolean`) are what the form renders and what the server validates. **Adding a sixth shape is a
  decision, not a convenience**: it means a new control in `ParamField`, a new branch in
  `wordOperationOf`, and a new thing every future reader has to know.
- **`answer`** — what the passage looks like once it has been applied. `marks` for marks of their
  own, `textStyle` for anything riding the shared `textStyle` mark (two of those on one run would
  render only the last), `attrs` for paragraph attributes.
- **`criteria`** — what must be true, *in the words the candidate reads*: "The paragraph is
  highlighted green", never "highlight assertion". Return more than one when the function is more
  than one statement, so a candidate who got the style right and the colour wrong sees which.
- **`licences`** — the formatting this question is allowed to have changed. Get this wrong and the
  closing `unchanged` criterion fails every correct answer, or passes answers that did extra work.
  Be *tight*: plain `underline` licenses `underline` and not `underlineStyle`, so a candidate who
  reached for a wavy line when asked for an underline is marked as having done something extra.
- **`describe`** — one line of English, for solution steps and the admin's summary.
- **Its topic** — `WORD_TOPIC_OF` in `src/exam/authoring/topics.ts`, typed as one entry per
  `WordOperation` kind, so a new operation without a topic **does not compile**. The per-question
  editor ticks the Topic dropdown from it. Pick an existing topic from `DOCUMENT_TOPICS` if one fits;
  see [Adding a topic](#adding-a-topic) otherwise.
- **`rewritesText: true`** — only for a function that changes the *wording*. It tells the rubric
  builder to leave out `unchanged`, which compares character by character against the starting
  document and would fail every correct answer to a replacement question.

### 3. Store and project the formatting, if it is new

Only if the property does not already exist in the document model. Five places, in this order:

1. `src/services/document/types.ts` — `RunFormatting` or `ParagraphFormatting`. A new
   `ParagraphFormatting` field is required-with-`null`, so add it to `EMPTY_PARAGRAPH_FORMATTING`.
2. The editor extension — `CharacterFormat`, `BlockFormat`, or `UnderlineFormat` — as an attribute
   *and* a command. Attributes on `textStyle` merge; a new mark does not.
3. `src/editor/proseMirrorToDocument.ts` and `src/editor/documentToProseMirror.ts` — both
   directions, or a loaded `.docx` and a submitted answer will disagree.
4. `src/exam/marking/flatten.ts` — `MarkName`, `canonicalMarks` (the canonical form decides what
   counts as "the same formatting"), and `hasMark`.
5. `src/editor/useFormatState.ts`, if the ribbon needs to show it.
6. **The single-document flow and its topic list** — every place in
   [the section below](#the-single-document-flow-and-the-topic-list). A new property that is not
   wired in there is invisible to that flow: an admin's change to it records as "nothing changed".

### 4. Give it a control

The ribbon (`HomeTab.tsx`) for something a candidate presses often; the Font or Paragraph dialog
for the rest. Add the command to `ribbonActions.ts` — components call named actions, never inline
chains.

### 5. Prove it

- `src/exam/authoring/authoring.test.ts` — the operation produces the model answer you expect.
- `src/server/marking/rubricFromOperations.test.ts` — **the load-bearing one**: for every question
  in the sample papers, the worked answer must *pass* the derived key and the untouched passage
  must *fail* it. The second half is what catches a key that passes everything.
- `src/exam/document/wordActions.test.ts` — add a case for the new action (see below).
- `npx tsc --noEmit -p .`, `npx eslint src`, `npx vitest run`.

## The single-document flow and the topic list

The second way to write a Word paper (`sdd/word-document-papers.md`): the admin performs each
question in the editor and the operation is **detected** from the before and after documents
(`src/exam/document/detect.ts`), rather than picked from the catalog. It reads the document model
directly, so a new property in `RunFormatting` or `ParagraphFormatting` has to be added here too —
and every property must belong to a **topic**, because the question form's Topic dropdown is ticked
from the detected operation.

### Adding a property

| Where | What to add | Enforced by |
| --- | --- | --- |
| `src/exam/document/detect.ts` | the property to `CHARACTER_PROPERTIES` (paragraph properties are read off `EMPTY_PARAGRAPH_FORMATTING` automatically) | **compile error** if a `RunFormatting` key is missing |
| `src/exam/document/topics.ts` | an entry in `TOPIC_OF` — see "Adding a topic" below | **compile error** if any property has no topic |
| `src/exam/document/describe.ts` | a branch in `describeCharacterChange` / `describeParagraphChange`, in the ribbon's words, for setting it *and* for taking it off | review — falls through to the raw property name |
| `src/server/marking/documentRubric.ts` | `markFor` / `licensedMarks` if it shares a slot with another mark (as sub/superscript and emboss/engrave do); `COLOURED` if it is a colour (either of Office's two reds passes); `VALUED` if the criterion must check its value | review |
| `src/exam/document/apply.ts` | `cleanMarks` / `cleanParagraph`, with a range check — the passage is rebuilt from known-good values | review — an unlisted property is silently dropped from saved passages |
| `src/exam/document/wordActions.test.ts` | an `ActionCase`: the ribbon action, the standard value it must be detected as, the markup it must render, how it is described, and a near miss | the suite |

### Adding a topic

The topics are the dropdown's options (`DOCUMENT_TOPICS` in `src/exam/document/topics.ts`), named
after the ribbon group or dialog section a candidate uses — "Font Style", "Line & Paragraph
Spacing", "Bullets & Numbering".

- **A new property goes into an existing topic when one fits.** A new underline variant is "Font
  Style"; a new spacing control is "Line & Paragraph Spacing". Add it to `TOPIC_OF` only.
- **A new topic is for a new ribbon group or dialog section** — e.g. when tables or page setup become
  markable. Add it to `DOCUMENT_TOPICS` in the position the ribbon would show it (the list order is
  the order topics are shown and stored in), then map its properties in `TOPIC_OF`.
- **Never put a comma in a topic name.** Topics are stored joined with `, ` in the existing `topic`
  column (`joinTopics` / `splitTopics`); `topics.test.ts` checks this.
- **Renaming or removing a topic orphans stored questions**: `splitTopics` drops names that are no
  longer on the list, and those questions reopen with their topics re-detected. Rename only with a
  data update to `word_doc_questions.topic`.
- The server accepts only topics on the list (`parseDocumentQuestionFields` for single-document
  questions, `parseQuestionInput` for per-question ones), so a new topic is
  usable as soon as it is in `DOCUMENT_TOPICS` — no form or validation change.
- Add the property → topic pair to the `it.each` tables in `src/exam/document/topics.test.ts`, and
  a catalog operation → topic pair to `src/exam/authoring/topics.test.ts`.
- **The per-question papers use the same Word list.** `TopicMultiSelect`
  (`src/components/authoring/`) is the one dropdown both editors render, so a topic added to
  `DOCUMENT_TOPICS` appears in both at once.

## Naming the text: selections

`src/editor/functions/selection.ts` is the other half of the vocabulary — how a question says
*which* text. `'all'`, a whole paragraph, the third word, the second sentence, a phrase (optionally
*wherever it appears*), or explicit character offsets.

- Add a selector by adding to `SelectionSpec`, `SELECTORS`, `resolveSelections` and
  `describeSelection`, then to `parseScope` in `src/db/testInput.ts` and the picker in
  `QuestionEditor.tsx`.
- Resolution is against the passage **text**, so a selector can never name a rendered line — where
  a line wraps depends on the page width and the font. A question about a wrapped line still uses
  character offsets, measured as `seedAttempt.ts` describes.
- A selection is stored, never resolved at authoring time. That is what lets one answer key be
  correct for both languages a paper is offered in.

## A question with more than one step

`WordQuestionDraft.steps` — a list of `{ scope, operations }`. Use it when a question names
different text for different parts ("number the first, second and fourth paragraphs") or does one
thing then another to the result ("replace the word, then bold it"). A single-step question keeps
using `scope` + `operations`; both arrive at the builders through `stepsOf`.

## What is not here yet

Deliberately, and worth knowing before promising a question type:

- **Tables** — the model has cells, but no cell shading, no per-cell borders, no structural
  operations (adding a column), and no selector that names a row, a column or a cell. Questions
  about tables cannot be authored or marked today.
- **Page-level settings** — headers and footers, page numbers, watermark text and orientation, page
  borders, and gutter margins. Some exist as view state in `src/state/uiStore.ts`, which the marker
  never sees; none are part of the document model that is submitted.

Both are new *families* rather than new functions: they need a place in the document model, a
projection, and their own criterion kinds. Say so rather than adding a function that records
nothing.
