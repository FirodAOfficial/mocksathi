# Exams & roles — implementation plan

Two additions to the schema from `sdd/auth.md`: a `role` on `users`, and a new `exams` table for
generic reference information about the recruitment exams candidates are preparing for (SSC CGL,
IBPS PO, etc.) — dates, links, eligibility. Not the mocks or questions for an exam, which stay a
separate concern; this is closer to a listings/notification-board table.

## Decisions

- **Roles: `student` | `admin` | `support`**, as a Postgres enum (`user_role`) on `users.role`,
  default `student`. `support` exists in the type and the database but nothing checks for it yet —
  added now because adding an enum value later is more friction than including it up front.
- **Exam data is generic and admin-authored**, not tied to any one exam-taking flow. Fields cover
  what was asked (exam date, registration open/last date, form submission start, organiser name +
  website, registration link, qualification requirement, details) plus what a real listing like
  this needs in practice: category, official notification link, admit card/result dates, age
  limits, application fee, vacancy count, exam mode, and a `status` (`draft` | `published` |
  `archived`) so an admin can prepare a listing before it's live. A `slug` is generated from the
  name server-side (not a form field) for a future public exam page's URL.
- **Admin-only, enforced twice.** The `/dashboard/admin/exams*` pages check `requireAdmin()`, and
  so does `POST /api/admin/exams` — independently, since the API is reachable directly regardless
  of what any page does. A non-admin gets a 404 (via `notFound()`), not a redirect or 403: that
  says "this doesn't exist" rather than "you're not allowed", which leaks less about what's here.
  Verified with a fresh non-admin signup: 404 on the page, 404 on the API, and the "Manage Exams"
  nav item simply isn't in their sidebar (`dashboardDataFor` only appends the Admin nav section for
  `role === 'admin'`).
- **All existing accounts were promoted to `admin`** directly in the database (`UPDATE users SET
  role = 'admin'`), per instruction, rather than building a role-management UI for this pass — new
  signups still default to `student`. Changing a role today means an `UPDATE` via `psql` or
  Drizzle Gateway (`README.md`); a "manage users" admin screen is future work if wanted.

## What's built

- [x] `src/db/schema.ts` — `USER_ROLES` / `userRoleEnum`, `users.role`; `EXAM_STATUSES` /
      `examStatusEnum`, the full `exams` table.
- [x] Migration `db/migrations/0001_fancy_bedlam.sql`, generated and applied — confirmed both
      existing users defaulted to `student`, then promoted to `admin` via a direct `UPDATE`.
- [x] `src/auth/cookies.ts` — `requireAdmin()`, built on `requireUser()`.
- [x] `src/db/slug.ts` — `slugify()`; the create route retries once with a random suffix on a slug
      collision (same exam name added twice) rather than failing the request.
- [x] `src/db/examInput.ts` — `parseExamInput`, shared by create and edit (same fields, same
      validation, same "missing means clear it" rule either way).
- [x] `POST /api/admin/exams` (`src/app/api/admin/exams/route.ts`) — validates `name` and
      `organiserName`, everything else optional; admin-gated.
- [x] `PUT /api/admin/exams/[id]` — replaces an exam. `PUT`, not `PATCH`: every field the caller
      omits gets cleared (same rule as create), which is whole-resource-replace semantics, not a
      partial merge — `PATCH` would have implied the latter and been misleading to any caller other
      than `ExamForm`, which always sends every field since its state starts from the existing
      exam. Regenerates the slug only if the name changed, so editing dates doesn't reassign it;
      retries once on a slug collision, same as create. 404s if the id doesn't exist.
- [x] `/dashboard/admin/exams` — list (`ExamsListScreen`), reads `exams` directly (no fixture
      involved, unlike the rest of `/dashboard/*`); an "Add exam" button and, per row, an "Edit"
      link.
- [x] `/dashboard/admin/exams/new` and `/dashboard/admin/exams/[id]/edit` — both render `ExamForm`
      (three sections: basic info, important dates, eligibility & fees); passing it an `exam` prop
      switches it from create to edit (pre-filled fields, `PUT` instead of `POST`, "Save changes"
      instead of "Add exam"). The edit page 404s if the id doesn't exist.
- [x] "Manage Exams" nav item, admin-only, new `shield` icon added to `DashboardIcon` /
      `NavIconName`.
- [x] End-to-end verified against the real local database: created an exam via the API as admin,
      confirmed it renders correctly in the list (name, organiser, formatted dates, status badge);
      opened its edit page and confirmed every field was pre-filled; edited it via `PUT` and
      confirmed the change (and only the change) landed; a fresh non-admin signup gets 404 on the
      list page, the add page, the edit page, and both API routes, and has no "Manage Exams" link.
- [x] `tsc --noEmit` and `eslint` clean on everything touched.

## Update — candidate exam registration + Profile/Settings merge

Two more requests landed together: candidates can now register for exams themselves (not just
admins creating the listings), and `/dashboard/profile` and `/dashboard/settings` are one page —
"both are related", and Settings had no real fields of its own yet.

- [x] `enrollments` table (`src/db/schema.ts`) — `userId` + `examId` (both FK, cascade delete),
      `isPrimary`, unique on `(userId, examId)`. "Only one primary per user" is enforced in code
      (a transaction in `src/db/enrollments.ts`), not a DB constraint — every write already goes
      through that one module, so a partial unique index wasn't worth the added migration
      complexity. Migration `db/migrations/0002_whole_black_bolt.sql`, generated and applied.
- [x] `src/db/enrollments.ts` — `enrollmentsForUser`, `availableExamsForUser` (published exams the
      user isn't registered for yet), `registerForExam`, `unregisterFromExam` (promotes another
      registration to primary if the removed one was it, so the topbar picker always has something
      to show when possible), `setPrimaryExam` (transaction: unset old primary, set new one).
- [x] Self-service API, any signed-in user (not admin-only, unlike `/api/admin/exams`):
      `POST /api/profile/enrollments` (register), `DELETE` / `PATCH /api/profile/enrollments/[examId]`
      (unregister / set primary).
- [x] **`dashboardDataFor` is now async** — it queries real enrollments (`enrollmentsForUser`) for
      every dashboard page, replacing what was fixture data (`SEED_DASHBOARD.enrollments`) for
      every caller, not just Profile. All ten call sites (`src/app/dashboard/**/page.tsx` and
      `layout.tsx`) updated to `await` it. `seedDashboard.ts` now carries `import 'server-only'`
      itself, since it's no longer purely fixture.
- [x] `PortalShell`'s topbar exam picker handles the now-real empty state (a new signup has zero
      enrollments): renders a "+ Add your exam" link to `/dashboard/profile` instead of blank text.
- [x] `/dashboard/settings` now `redirect()`s to `/dashboard/profile` rather than being deleted —
      it was a real, linked nav destination before this, unlike the fully-orphaned
      `/dashboard/analysis` that got deleted outright earlier. Nav's "Profile" + "Settings" items
      collapsed into one, "Profile & Settings".
- [x] `ProfileScreen` gained `ExamEnrollmentsCard` (client component: list of registered exams with
      Set primary / Remove, plus a picker to register for another) and a "Preferences" card — the
      honest placeholder Settings used to be, now inline instead of its own page.
- [x] **Bug caught and fixed during this pass, not before**: duplicate-registration and duplicate-slug
      handling both 500'd instead of returning 409/detecting the collision. drizzle-orm wraps the
      driver's error in its own `DrizzleQueryError`, with the real `pg` error (the one carrying
      `.code`) attached as `.cause` — the existing `isUniqueViolation`/`isUniqueSlugViolation`
      helpers (in `src/db/enrollments.ts` and `src/db/examInput.ts`, written during the earlier
      exams and auth passes) only checked `error.code` directly and never matched. Consolidated
      into one correct `src/db/pgErrors.ts::isUniqueViolation`, checking both `error.code` and
      `error.cause.code`; both call sites updated. Re-verified: duplicate registration now 409s.
- [x] End-to-end verified against the real local database: registered for two exams, confirmed the
      first became primary automatically; set the second as primary and confirmed the topbar
      picker updated; unregistered from both and confirmed the topbar's empty-state link appeared;
      re-registering after unregistering, and unregistering from something never registered, both
      behave correctly (409 / 404). Full route sweep clean for both admin and a non-admin account.
- [x] `tsc --noEmit` and `eslint` clean on everything touched (whole `src/` tree, not just the
      changed files, given how many call sites the async `dashboardDataFor` touched).

## Update — signup redesign, exam picker at signup, and a public exams API

`/signup` got the same split-screen treatment as `/login` (`sdd/auth.md`), plus a new piece:
picking a target exam is now part of creating an account, not something you can only do
afterward from Profile.

- [x] `SignupForm` gained an optional "Target exam" `<select>` (hidden entirely if no exams are
      published yet — same honest-empty-state pattern as `ExamEnrollmentsCard`). `POST
      /api/auth/signup` accepts an optional `examId` and, after the account is created,
      best-effort registers it via `registerForExam` (silently skipped if the exam went away
      between page load and submit — a signup should never fail because of that). Since it's the
      account's first-ever registration, it becomes primary automatically, same rule as any other
      first registration.
- [x] **New: `GET /api/exams`** (`src/app/api/exams/route.ts`) — the one exam-related route that
      doesn't require being signed in. Minimal fields only (`id`, `name`, `category` — never
      organiser details, dates, fees, or anything else `exams` carries), and only `published`
      exams (drafts stay invisible to it, same as everywhere else). Added specifically so an
      unauthenticated context (the signup form, before there's a session) has a real API to call
      rather than the page quietly reaching into the DB layer with no public surface at all.
      Audited every other exam/enrollment route to confirm this is the only exception:
      `/api/admin/exams*` still 307s (via `requireAdmin`) and `/api/profile/enrollments*` still
      307s (via `requireUser`) when hit without a session.
- [x] End-to-end verified: signed up a brand-new account with an exam selected, confirmed it
      landed as that account's primary exam on both the Profile page and the topbar picker
      immediately, no page reload beyond the signup redirect itself.
- [x] `tsc --noEmit` and `eslint` clean.

## Not done / out of scope for this pass

- [ ] No delete for an exam once created — add, list, and edit only.
- [ ] No public-facing exam listing/detail page yet (the `slug` is there for when one exists).
- [ ] No admin UI for changing a user's role — direct DB edit only (`psql` or Drizzle Gateway).
- [ ] `support` role has no actual permissions defined yet — reserved for later.
- [ ] "Preferences" on the merged Profile & Settings page is still a placeholder note, not real
      fields — same honest-placeholder status Settings had as its own page.
- [ ] Automated tests — same standing deferral as `sdd/dashboard.md` / `sdd/auth.md`.
