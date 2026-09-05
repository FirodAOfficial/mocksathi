# Browser Word Processor

A Microsoft Word 2010–style word processor that opens `.docx` documents from a URL and
lets you edit them in the browser.

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>, or go straight to a document:

```
http://localhost:3000/editor?docUrl=https://calibre-ebook.com/downloads/demos/demo.docx
```

Omit `docUrl` for a blank document.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run the tests in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

---

## The central constraint: no keyboard shortcuts

Every editing action goes through the ribbon. <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>B</kbd>
does not embolden text; the Bold button does.

This is enforced in two independent layers, because either one alone leaks
([`src/editor/extensions/ribbonOnlyShortcuts.ts`](src/editor/extensions/ribbonOnlyShortcuts.ts)):

1. **`ribbonOnly()` rebuilds each extension without its triggers.** Tiptap extensions declare
   their own keymaps, so `Bold` genuinely no longer binds `Mod-b` — there is no handler left to
   reach. The same wrapper strips **input rules** and **paste rules**, because `**bold**`
   auto-converting as you type would be a second, quieter way to format without the ribbon.
2. **A ProseMirror plugin swallows `Mod`+*character* at priority 1000.** This catches anything a
   future extension adds, plus browser defaults that would otherwise fire inside the editor.

Two categories are deliberately left working, because neither is a formatting or document command:

- **Clipboard and select-all** (`Mod-C/X/V/A`) are operating-system behaviours. The ribbon cannot
  replace them, and blocking them would break ordinary text entry.
- **Named keys** — arrows, Home/End, Backspace, Delete, Enter — are navigation and text entry, and
  stay with ProseMirror's base keymap. The guard only inspects single-character keys, so these
  never reach it. `Shift`+`Enter` is the one binding kept from any extension, since inserting a
  line break is typing rather than formatting.

[`src/editor/ribbonOnlyEditing.test.ts`](src/editor/ribbonOnlyEditing.test.ts) asserts both halves
of this for each shortcut: that the key does nothing, **and** that the ribbon command still works.
Testing only the first would pass just as happily if the command itself were broken.

---

## Architecture

The application is four layers that know nothing about each other's internals. Each boundary is a
plain data structure or a small interface, so any layer can be replaced without touching the rest.

```
URL ──▶ proxy ──▶ parser ──▶ DocumentModel ──▶ adapter ──▶ ProseMirror ──▶ ribbon UI
        (server)   (docx)     (normalised)     (editor)
```

### 1. Fetching — `src/server/`

`fetchRemoteDocument.ts` is the only place the application reaches the internet. It runs
server-side for two reasons: arbitrary document hosts do not send CORS headers, so a direct browser
fetch fails for most real URLs; and the destination must be vetted somewhere the user cannot tamper
with. See [Security](#security).

### 2. Parsing — `src/services/document/`

Parsers are pure **bytes in, model out**. They never fetch, never touch the DOM, and never know an
editor exists.

Format is decided by **magic number**, not by filename or `Content-Type` — both are attacker- or
misconfiguration-controlled ([`detectFormat.ts`](src/services/document/detectFormat.ts)).
`registry.ts` maps a detected format to a `DocumentParser`; supporting RTF or ODT means writing one
class and adding one line.

The DOCX parser is split by concern: `xml.ts` (order-preserving OOXML access), `units.ts` (twips,
half-points, colour names), `properties.ts` (`w:rPr` / `w:pPr`), `styles.ts` (the `basedOn`
inheritance chain), `numbering.ts` (the `numId → abstractNumId → level` indirection), and
`DocxDocumentParser.ts` (the body walk).

### 3. The normalised model — `src/services/document/types.ts`

One format-agnostic representation sits between parser and editor. Units are normalised at the
parser boundary: **CSS pixels** for lengths, **points** for font sizes, `#rrggbb` for colours.
Downstream code never sees a twip.

### 4. Editor and UI — `src/editor/`, `src/components/`

`documentToProseMirror.ts` and `proseMirrorToDocument.ts` are the only modules that speak both
vocabularies. The reverse direction exists so editor state can be read back in the application's own
terms — for word counts, for round-trip tests, and as the input a future `.docx` writer would consume.

`ribbonActions.ts` holds every mutation the ribbon can perform, so components stay declarative and
the command vocabulary is testable without rendering anything.

---

## Security

The proxy accepts a user-supplied URL, which makes it a server-side request forgery primitive unless
the destination is restricted. Defences, in order of application:

| Control | Where |
| --- | --- |
| `http`/`https` only; URLs carrying credentials refused | `validateUrl.ts` |
| DNS resolution, with **every** returned address checked | `fetchRemoteDocument.ts` |
| Loopback, private, link-local, CGNAT, multicast and reserved ranges blocked — including cloud metadata at `169.254.169.254`, and IPv4-mapped IPv6 forms such as `::ffff:127.0.0.1` | `ipRules.ts` |
| Redirects followed **manually**, re-validating each hop (max 3) | `fetchRemoteDocument.ts` |
| 15 s timeout; 25 MB cap enforced while streaming, not just from `Content-Length` | `fetchRemoteDocument.ts` |
| `text/html` and script types refused outright | `fetchRemoteDocument.ts` |
| Response served as `application/octet-stream` with `Content-Disposition: attachment` and `nosniff` | `api/document/route.ts` |
| XML declaring a DTD or entities is rejected, removing the XXE and billion-laughs classes entirely | `parsers/docx/xml.ts` |
| Zip parts over 32 MB refused using the declared uncompressed size, before inflating | `DocxDocumentParser.ts` |

`ipRules.test.ts` pins each family of "looks public but is not" address.

**Known residual risk — DNS rebinding.** A hostile DNS server can answer differently between the
address check and the connection. Closing this requires pinning the connection to the checked
address with a custom dispatcher; it is deliberately listed here rather than papered over.

**Not implemented: rate limiting.** The proxy will fetch as often as it is asked. A deployment
facing the public internet should put a rate limit in front of `/api/document`.

---

## Formatting loss is visible, never silent

The parser records anything it recognised but chose not to represent, and the editor shows it in a
dismissible strip above the document. Loading the calibre demo document reports, accurately:

> - Fixed line spacing ("exact") was replaced with single spacing.
> - Hyperlinks were kept as plain text.
> - Images and drawings were removed.
> - Tables were flattened into ordinary paragraphs.

Two decisions worth calling out:

- **Tables are flattened, not dropped.** Discarding the element would also discard its text, so cell
  paragraphs are lifted into the body and the loss of *structure* is reported.
- **Fixed line spacing is not approximated.** `lineRule="exact"` is an absolute height; the model
  carries a multiplier. Guessing a conversion would misreport the document, so it is reported as lost.

---

## The exam review panels

The editor sits between two panels, so a document can be written while reviewing an attempt.

**Left — the question list.** Scrolls independently of the page, and selecting a question from
anywhere (this list, the palette on the right, the arrow keys, or the question-paper dialog) scrolls
it into view. The selected question is drawn as the arrow marker from the design.

The scroll offset is computed and assigned rather than delegated to `scrollIntoView`: its `smooth`
behaviour proved unreliable for a nested scroll container — in the browser it left the list at
`scrollTop` 0 while a direct assignment moved it correctly every time.

**Right — the candidate summary.** Profile, a status legend, a **10-minute countdown**, the question
palette, and the controls for navigating and submitting.

### Attempted is derived, never stored

There is no "Attempted" button. A question counts as attempted exactly when its document differs
from the text it started with; skipping it — pressing Next, or picking another from the list —
leaves it untouched, so it stays unattempted.

That is a deliberate choice over a pair of buttons: a stored flag can disagree with what is actually
typed, and then the palette is lying. `statusOf()` reads the answer map, so the badge, the legend and
the document cannot drift apart. The panel *states* the current question's status rather than
offering a control that could contradict it.

**Clear** discards the question's text, which returns it to unattempted by the same rule. It is
disabled when there is nothing to clear.

### The countdown, and what happens when it ends

The countdown derives its remaining time from a fixed deadline rather than decrementing a counter
each tick. Browsers throttle timers in background tabs, so a decrementing counter silently runs
slow — the clock would be wrong by however long the candidate looked at another tab. There is a test
for exactly that.

At zero the paper is **auto-submitted**: whatever is in the editor is stored first — that is what
makes it a submission rather than a discard — then the paper locks and the **result screen** opens.
The editor becomes non-editable, a banner explains why, and the recording controls are disabled.
Navigation stays live so the paper can still be read back.

Submitting by hand does the same thing, with a confirmation first. Whichever happens first wins: a
candidate pressing Submit as the clock runs out is not recorded as a timeout.

The result screen reports what was handed in — attempted, not attempted, marked for review — and
says plainly that **no score is shown, because nothing in this build marks answers**. Inventing a
percentage would be worse than saying so.

### Keeping the page inside its column

The document area is one scroll container holding the ruler and the sheet at a shared width, so the
two stay aligned and neither can spill over the side panels at any zoom level.

The bug this replaced is worth recording. The sheet was centred with `justify-content: center`, which
looks right until the page is wider than the column — then the overflow is pushed out of *both*
sides and escapes the container. Measured at 100% zoom, the column ran 243→973 while the page ran
200→1016, sitting 43px over each panel. Centring the child with `margin: 0 auto` instead pins its
left edge to the container once it no longer fits, so all the overflow is on the scrollable side and
stays reachable; `contain: paint` makes the containment explicit rather than incidental.

Both scrollbars are forced to be always visible, using the same technique as the question list — a
zoomed page needs to *look* scrollable. Verified at 200%: the page stays within the column at both
scroll extremes, and the full width is reachable.

### One document per question

Each question owns a separate ProseMirror document, seeded with a heading, the question text, and an
empty paragraph to answer in. Moving between questions stores whatever was typed and installs the
target question's document.

Two details this gets right:

- **Only genuinely edited questions are stored.** Both documents are normalised through the editor's
  schema before comparison — `getJSON()` fills in every default attribute a node declares
  (`styleName: null`, `textAlign: null`, …) that a hand-written document does not carry, so comparing
  raw against serialised marks *every* question as edited. A test caught this. This map is also what
  "attempted" is derived from, so the bug would have marked the whole paper answered.
- **Each question has its own undo history.** The swap re-creates the `EditorState` rather than
  issuing a `setContent` command, which would push the swap onto the undo stack — undoing on
  question 5 could otherwise pull question 4's text back in.

Edits survive moving between questions and are dropped on refresh or when **Clear** is pressed.
That is in-memory by design, not a missing feature.

Status is carried by **shape as well as colour** in the palette — attempted questions are green
domes, unattempted ones white squares, with a purple dot for "marked for review" — so it stays
readable without colour vision, and every cell states its status in its accessible name.

### Data

`src/exam/seedAttempt.ts` holds a fixed 15-question paper. It carries no answer state at all — only
the questions and which are flagged for review — because everything else is derived from what the
candidate types. It is a fixture, not a fallback: `useExamStore.setAttempt()` replaces it wholesale
once a real source exists, and nothing else reads from it. Exam state lives in its own store,
separate from the editor's chrome state, so the editor still works if the panels are dropped.

**Not built:** there is no exam backend, so submitting closes the paper locally and sends nothing,
and no answer is ever marked. Answers are not persisted beyond the page session.

---

## What is not built

Stated plainly, because a control that looks live and does nothing is worse than an absent one.

- **No pagination.** The document renders as one continuous sheet at page width. The status bar
  therefore says "13 pages" (a count estimated from content height), not "Page 1 of 13", which would
  imply a cursor position the editor cannot compute.
- **No saving or export.** There is no `.docx` writer. `proseMirrorToDocument` is the input such a
  writer would need.
- **Images, tables, footnotes, hyperlinks** are not in the model. Their text survives where it can;
  the rest is reported.
- **Legacy `.doc`** (Word 97–2003) is detected by its OLE2 signature and reported precisely — it is
  a compound binary format needing a server-side converter, so it fails with an accurate message
  rather than an obscure parse error.
- **Tabs beyond Home** carry only controls that genuinely work: Insert (Symbol, Date & Time), Page
  Layout (margins, orientation, indent, spacing), Review (word count, restrict editing), View
  (ruler, zoom, print). Word's real tabs are far larger; the difference is absence, not mockups.
- **The ruler is informational.** Word's draggable indent markers would be a formatting control, and
  formatting lives in the ribbon.
- **Paste is plain text or HTML** via the async Clipboard API. Browsers can refuse it; the failure
  surfaces in the status bar rather than being swallowed.
- **The window buttons** in the title bar are decorative and `aria-hidden` — this is a web page.
- **The side panels do not narrow the page.** The page keeps its true 816px width, so with both
  panels open it is usually wider than the column left for it and the document area scrolls. It is
  properly contained — see below — but there is no automatic fit-to-width; the zoom control in the
  status bar is the way out.

---

## Tests

154 tests across 13 files.

| File | Covers |
| --- | --- |
| `DocxDocumentParser.test.ts` | Real `.docx` packages built with JSZip: formatting, style inheritance, unit conversion, lists, tables, DTD rejection |
| `ribbonOnlyEditing.test.ts` | Shortcuts inert **and** ribbon commands working, in a live editor |
| `ipRules.test.ts` | Every blocked address family, and public addresses that must not be blocked |
| `documentToProseMirror.test.ts` | List-nesting reconstruction, mark mapping, full round trip |
| `DocumentLoader.test.ts` | Orchestration and error codes, with a stub transport |
| `validateUrl.test.ts` | Scheme and credential rejection |
| `HomeTab.test.tsx` | Ribbon click → editor command, and `aria-pressed` / `aria-checked` state |
| `ExamTimer.test.tsx` | Countdown, the background-tab accuracy case, warning and expiry states |
| `ExamSummaryPanel.test.tsx` | Derived counts and status, palette filtering, submit and lock |
| `useQuestionAnswers.test.ts` | Per-question documents, edit retention, per-question undo, clear |
| `ResultDialog.test.tsx` | The result screen, and auto-submit when the countdown ends |
| `QuestionListPanel.test.tsx` | Selection and keyboard navigation |
| `types.test.ts` | Status counting and duration formatting |

The DOCX tests assemble genuine zip packages rather than stubbing the XML layer, so they cover the
zip handling, part lookup and namespace prefixes too.

The panels' scroll-into-view behaviour is deliberately *not* asserted in jsdom: it performs no
layout, so every element reports a zero rect and the calculation has nothing to work from. It was
verified in a real browser instead, and the test says so rather than pretending otherwise.

Five real bugs were found and fixed this way: indentation not accumulating when the whole document
was selected (the selection anchor's parent is the doc node, whose attrs carry no indent), quoted
text staying quoted when restyled as a heading (`lift` refuses a range containing the blockquote
itself), the styles gallery announcing itself as "AaBb Heading 1", and every question being recorded
as edited because a hand-written document was compared against a schema-normalised one, and the
document overflowing onto both side panels when it was wider than its column.

---

## Accessibility

Ribbon tabs use the `tablist` pattern with arrow-key navigation and roving `tabIndex`. Toggle
buttons expose `aria-pressed`; one-shot commands deliberately do not, or a screen reader would
announce them as permanently "not pressed". Menus are `menu`/`menuitemradio` with `aria-expanded`,
Escape-to-close and focus restoration. Groups are labelled regions. Disabled controls explain
*why* in their tooltip. Every control has a real accessible name.

Controls suppress focus on `mousedown` — without that, clicking a ribbon button blurs the editor and
collapses the very selection being formatted.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict, `noUncheckedIndexedAccess`) ·
Tiptap 3 / ProseMirror · JSZip + fast-xml-parser · Zustand · CSS Modules · Vitest +
Testing Library.

`StarterKit` is deliberately unused: it bundles keymaps and input rules, and the point of this build
is that every formatting trigger is explicit and auditable.
