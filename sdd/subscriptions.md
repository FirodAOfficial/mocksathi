# Subscriptions & plans — implementation plan

Three requests that landed together and share one data model: an admin report on who's
subscribed, admin-defined subscription plans (including the free/default one), and a real
self-serve upgrade page for candidates — plus a sidebar status widget showing free-tier usage or
days remaining. No payment gateway exists anywhere in this: choosing a plan activates it directly.

## Decisions

- **`subscriptions` is one row per user** (`userId` unique), not a history log — same reasoning as
  `enrollments`' original design. A plan change updates the row in place.
- **Plans are a separate table (`subscription_plans`), not free text on `subscriptions`.** The
  first pass at the admin subscriptions report used a free-text `plan` column; adding admin-defined
  plans (price, duration, mock limit, features) made that insufficient immediately, so
  `subscriptions.planId` now references `subscription_plans.id`. Migrated in two unambiguous steps
  (`0004`, `0005`) rather than one, because `drizzle-kit generate` wants an interactive prompt to
  disambiguate "renamed `plan` to `plan_id`?" and this environment has no TTY — added `planId`
  nullable alongside the untouched `plan` column first, then dropped `plan` and tightened `planId`
  to `NOT NULL` as a second, unambiguous diff (a plain drop + a plain alter, not a remove-and-add
  pair for drizzle-kit to second-guess).
- **Exactly one plan is `isDefault`** — the one a brand-new signup lands on automatically, and the
  one `currentPlanForUser` falls back to for a user with no `subscriptions` row at all (so existing
  accounts predating this feature aren't broken, no backfill needed). Enforced in code
  (`src/db/plans.ts::setDefaultPlan`, a transaction), same reasoning as `enrollments`' "only one
  primary".
- **No payment gateway.** `POST /api/profile/subscription` *is* the entire purchase flow — a
  signed-in user activating a plan directly. The upgrade page says so ("No payment gateway is
  connected yet — choosing a plan activates it immediately, at no charge") rather than the
  reference mockup's "Secure Payment" claim, which would be false.
- **Mock usage is still fixture-derived** (`fixtureMocksUsedCount`, reading `SEED_DASHBOARD`'s
  calendar), not real tracking. Building real per-user mock-attempt tracking is a materially bigger
  feature than "show free-tier usage in the sidebar" — the mocks system itself is still entirely
  fixture (`sdd/dashboard.md`). Subscription *status* (plan, subscribed or not, days remaining) is
  real DB data; the "X of Y used" number sits next to it honestly labelled as illustrative in code
  comments, consistent with how the rest of the still-fixture dashboard is documented.
- **`subscriptions.planId` has no `onDelete`** (Postgres default, NO ACTION) — a plan with active
  subscribers can't be deleted out from under them. The admin plans UI only supports deactivating
  (`isActive`), not deleting, on purpose.
- **The upsert avoids the unique-violation bug entirely.** `subscribeUserToPlan` uses
  `.onConflictDoUpdate({ target: subscriptions.userId, ... })` rather than insert-then-catch, so
  there's no `error.code`/`error.cause.code` check to get wrong here (see `sdd/auth.md`'s note on
  that exact bug happening twice already) — the DB handles the conflict natively.

## What's built

- [x] `subscription_plans` table (`src/db/schema.ts`): name, price (₹, integer), duration in days
      (null = never expires), mock limit (null = unlimited), `features` (admin-authored text array,
      shown as-is), `isDefault`, `isPopular` (cosmetic "Most Popular" badge), `isActive`, sort order.
- [x] `subscriptions.planId` replacing the earlier free-text `plan` column (see migration note
      above).
- [x] `src/db/plans.ts` — `listPlans`, `getPlanById`, `createPlan`/`updatePlan` (either one calls
      `setDefaultPlan` if `isDefault` is set, keeping the invariant from either write path),
      `currentPlanForUser` (real subscription if one exists, else the default plan, else `null` if
      no default is configured yet — callers handle that gracefully, not a crash),
      `subscribeUserToPlan`, `subscribeUserToDefaultPlan` (best-effort, called from signup).
- [x] `src/db/planInput.ts` — shared parse/validate for the admin create/edit routes, same pattern
      as `examInput.ts`.
- [x] Admin CRUD: `POST /api/admin/plans`, `PUT /api/admin/plans/[id]` (`requireAdmin()` each);
      `/dashboard/admin/plans` (list), `/new`, `/[id]/edit` — add/edit only, no delete, same
      reasoning as exams.
- [x] Admin report (from the earlier request in this session): `/dashboard/admin/subscriptions`
      updated for the new schema — `subscriptionSummary`/`paginatedUsersWithSubscription` now join
      `subscription_plans` for the plan name, and "is subscribed" now also excludes the default
      plan explicitly (a user on the free/default plan was never meant to count as "subscribed"
      even before plans existed as their own table).
- [x] Self-service: `POST /api/profile/subscription` (`requireUser()`) — the entire "purchase" flow.
      Signup (`POST /api/auth/signup`) now also calls `subscribeUserToDefaultPlan` after creating
      the account, best-effort (a signup should never fail because no default plan is configured).
- [x] `/dashboard/subscription` — candidate-facing upgrade page, adapted from a reference mockup:
      current-plan summary (usage bar for the free tier, days-remaining for a paid one), a card per
      active plan (dark, "Most Popular" badge on `isPopular`, real price/duration/mock-limit/
      features pulled from the DB, not hardcoded), disabled "Current Plan" button on whichever
      plan the user is on. Falls back to a `ComingSoonScreen` if no default plan is configured yet
      (a fresh install, before an admin has set one up) rather than crashing.
- [x] Sidebar status widget (`PortalShell`, simplified/student menu only — admins don't see it):
      real plan name and subscribed/free status; free tier shows a usage bar and "Upgrade now" link
      to `/dashboard/subscription`, a paid plan shows days remaining and a "Manage plan" link.
      `dashboard/layout.tsx` skips the `currentPlanForUser` query entirely for admins (`simplifiedMenu`
      false), rather than fetching and discarding it.
- [x] Seeded via the new admin API (not fixture, not raw SQL this time — the CRUD exists, so used
      it): a `Free` default plan (5-mock limit) and two paid plans, `6 Months` (₹1,499) and
      `1 Year` (₹1,999, marked popular) — same figures as the reference mockup, since those aren't
      false claims, just admin-configurable example pricing.
- [x] **Auth-security-review skill applied** (`.claude/skills/auth-security-review/`, built last
      session) — checked before and after writing: every new DB-touching route gated
      (`requireUser()` self-service, `requireAdmin()` admin CRUD), the new FK's `onDelete` chosen
      deliberately, no unique-violation hand-rolling introduced (the upsert avoids needing one at
      all). Ran the skill's grep-based audit procedure against the three new route files, then
      verified empirically: every one of them 307s or 404s an unauthenticated/wrong-role request.
- [x] End-to-end verified against the real local database: seeded plans via the admin UI; as a
      non-admin, confirmed the free-tier widget and upgrade page render correctly; activated the
      `1 Year` plan via the real API, confirmed it immediately shows as the current plan on the
      upgrade page, the sidebar widget switches to "days remaining", and the admin subscriptions
      report's "subscribed" filter picks it up — one action, three places, no manual refresh
      beyond normal navigation.
- [x] `tsc --noEmit` and `eslint` clean on the whole `src/` tree.

## Not done / out of scope for this pass

- [ ] No delete for a plan once created — matches the exams precedent.
- [ ] No real mock-attempt tracking — "mocks used" stays fixture-derived until the mocks system
      itself is real (`sdd/dashboard.md`).
- [ ] No payment gateway, obviously — see "Decisions" above. Whenever one gets connected,
      `subscribeUserToPlan` is the natural place to gate behind a successful payment instead of
      calling it directly from the API route.
- [ ] No subscription history — a renewal or downgrade simply overwrites the one row. A
      `subscription_events` table would be the natural next step if history/audit matters later.
- [ ] Automated tests — same standing deferral as every other `sdd/*.md` doc.
