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

## Not done / out of scope for this pass

- [ ] No delete for an exam once created — add, list, and edit only.
- [ ] No public-facing exam listing/detail page yet (the `slug` is there for when one exists).
- [ ] No admin UI for changing a user's role — direct DB edit only (`psql` or Drizzle Gateway).
- [ ] `support` role has no actual permissions defined yet — reserved for later.
- [ ] Automated tests — same standing deferral as `sdd/dashboard.md` / `sdd/auth.md`.
