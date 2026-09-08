# Dashboard — implementation plan

Source design: `design/Quiz website UI mockups.zip` → `Dashboard 1.0.dc.html`, screens `1a`–`1n`
(candidate exam-prep portal: instructions, live quiz, overlays, result, solutions, analysis,
weak/strong areas, mock calendar, practice zone, PYQ + bookmarks, leaderboard, profile, landing,
mobile). Extracted to `design/mockups_extracted/` for reference during build (gitignored scratch —
not committed).

## Scope decision

The sidebar in every screen carries a standalone **Dashboard** nav item, separate from Mock
Calendar / Overall Analysis / etc. — but no screen in the mockup is that item's own canvas. This
plan builds that landing screen at `/dashboard`, composed from the recurring card patterns already
approved elsewhere in the file (streak, challenge progress, score trend, subject snapshot, weak
areas, recent mocks). The other nav destinations (Mock Calendar, Overall/Subject/Topic Analysis,
Practice Zone, PYQ Papers, Bookmarks, Leaderboard, Profile) become their own routes later, reusing
the shell built here — listed as Phase 5 backlog, not built now.

This is a second, distinct visual system from the existing Word-editor app (Inter font, `#1c6ef2`
accent, card/grid layout vs. the Office chrome in `globals.css`). Dashboard styling stays scoped to
`src/app/dashboard/` — a dedicated stylesheet loaded only by the dashboard layout — and does not
touch the editor's tokens.

Data for every phase below is hardcoded fixture JSON/TS (same pattern as `SEED_ATTEMPT` /
`fixtureFor` in `src/exam/`). No database work happens in this pass; schema is written so a real
data layer (planned as Postgres for relational/transactional data — users, enrollments, attempts,
streaks, leaderboard rank — plus MongoDB for flexible content — question bank, analysis blobs — not
finalised) can be dropped in later without reshaping the types the screen renders.

**Update — the dashboard is now the app's default page.** `/` redirects to `/dashboard`
(`next.config.ts`), and `/dashboard/*` requires login (`sdd/auth.md`) now that real accounts
exist. The old `/` home page (sit the sample exam / open a document / start blank) moved to
`/dashboard/today`, restyled to the dashboard's card system — see Phase 5. `dashboardDataFor(user)`
(`src/dashboard/seedDashboard.ts`) overlays the signed-in user's real name onto
`SEED_DASHBOARD.candidate`; every page still fixture data otherwise.

## Phase 1 — Domain types & fixtures (schema)

New module `src/dashboard/`, mirroring the existing `src/exam/` convention (flat types + a `seed*`
fixture, pure helper functions colocated with the types they operate on).

- [x] `src/dashboard/types.ts` — types needed now, plus stubs for screens planned in Phase 5 so the
      shape doesn't need reworking later:
  - `CandidateProfile` (id, name, initials, role, avatar colour)
  - `ExamEnrollment` (examId, examName, year, isPrimary) — powers the "SSC CGL 2025 / also enrolled…" picker
  - `StreakState` (currentStreakDays, lockHour, hoursMinutesLeft, lastMissedDate)
  - `ChallengePlan` (name, totalDays, completedDays, totalMarks, maxMarks, missedDays)
  - `MockCalendarDay` (date, mockNumber, status: `attempted | missed | today | locked | upcoming`, marksLabel, minutesSpent)
  - `MockSummary` (mockNumber, paperName, totalQuestions, status: `done | today | missed | locked`, score, maxScore, accuracyPct, rank, timeSpentSeconds, date, isBestScore) — deliberately close to but separate from `ExamResult` in `src/exam/result.ts`; a real backend will likely derive one from the other, not merge them
  - `PerformanceSnapshot` (averageScore, maxScore, scoreDeltaVsLastWeek, accuracyPct, accuracyDeltaPts, attemptRatePct, bestPercentile, bestPercentileMockNumber, bestPercentileRank)
  - `SubjectSnapshot` (subject, avgMarks, maxMarks, accuracyPct, avgTimeSeconds, benchmarkPct, colorToken)
  - `WeakArea` (topic, subject, priority: `High | Medium | Low`, avgMarks, maxMarks, accuracyPct, attempts, lastPracticedLabel)
  - `StrongArea` (topic, masteryPct)
  - `NotificationItem` (id, message, createdAt, read) — stub only, unread count shown in topbar
  - `NavItem` / `NavSection` — static IA data for the sidebar (see Phase 2)
- [x] `src/dashboard/seedDashboard.ts` — one `SEED_DASHBOARD` fixture object built from the mockup's
      own sample data (Aman Verma / SSC CGL 2025 / Mock 19 / 18-day streak / etc.), plus any small
      pure helpers the screen needs (e.g. `daysUntilLock`, `formatMarks`) — same spirit as
      `formatClock` / `outcomeOf` in `src/exam/result.ts`.
- [x] Unit tests for the pure helpers only (`src/dashboard/seedDashboard.test.ts`), following the
      existing `*.test.ts` convention — no component tests yet, that's Phase 4. Written but not run:
      `npm test` currently fails in this environment on an unrelated pre-existing issue
      (`@rollup/rollup-win32-x64-msvc` missing, a known npm optional-deps bug) — deferred to Phase 4
      per instruction to hold all test running until after the database integration.

## Phase 2 — Portal shell & route scaffold

- [x] `src/app/dashboard/layout.tsx` — nested layout that renders the persistent shell (sidebar +
      topbar) around `children`, and loads the dashboard-only stylesheet/font. Metadata title
      "Dashboard".
- [x] `src/components/dashboard/PortalShell.tsx` (+ `.module.css`) — sidebar (logo, grouped nav:
      Dashboard / Mocks / Analytics / Study tools / Account, from `NavSection` fixture data) and
      topbar (exam picker, streak badge, notification bell, avatar). Nav items beyond `/dashboard`
      render as inert (no route yet) in this pass — see Phase 5.
- [x] `src/app/dashboard/page.tsx` — the route itself; passes `SEED_DASHBOARD` into the screen
      component. Server component, same shape as `src/app/result/page.tsx`.
- [x] Confirm `/dashboard` resolves in `next dev` and that the existing routes (`/`, `/exam`,
      `/editor`, `/result`) are unaffected. Checked via curl against the running dev server: all
      five routes return 200, and the RSC payload for `/dashboard` carries the expected fixture text
      (candidate name, streak, calendar month, weak areas, recent mocks).

## Phase 3 — Dashboard home screen

`src/components/dashboard/DashboardScreen.tsx` composed of focused sub-components (own
`.module.css` each, matching the file-per-component convention in `src/components/result/`):

- [x] `StreakCard` — flame icon, "N day streak", lock countdown, "Start Mock N" CTA
- [x] `ChallengeProgressCard` — completed/total bar, total marks, missed days
- [x] `MockCalendarPreview` — compact month grid (attempted/missed/today/locked legend)
- [x] `PerformanceSnapshot` — average score / accuracy / attempt rate / best percentile tiles
- [x] `SubjectSnapshotList` — per-subject bar with benchmark marker
- [x] `WeakAreasCallout` — top priority topics with a "Practice" link
- [x] `RecentMocksTable` — today's mock + recent `MockSummary` rows with Start/Solutions/Locked actions
- [x] Wire all of the above into `DashboardScreen`, fed entirely by `SEED_DASHBOARD`

## Phase 4 — Tests (deferred)

Holding per instruction: skip running tests until the database integration lands, then do this pass
in full.

- [x] `src/dashboard/seedDashboard.test.ts` written (Phase 1) — not yet run
- [ ] `DashboardScreen.test.tsx` — renders with the fixture, asserts key figures appear (streak
      count, average score, weak-area topic names), following `ResultScreen.test.tsx` /
      `InstructionsScreen.test.tsx` conventions
- [ ] `npm run typecheck` (passing as of this build), `npm run lint` (passing as of this build),
      `npm test` all green — `npm test` is currently blocked by the unrelated Rollup native-binding
      issue above; re-check it hasn't been fixed by then
- [ ] Manual pass in the browser: `npm run dev`, open `/dashboard`, check layout at the 1280px
      card width the mockup was designed at and at a narrower viewport (no dashboard mockup screen
      is mobile-sized except the separate `1n` mobile set, which is out of scope here). Verified so
      far only via the rendered HTML/RSC payload (curl), not a real browser — do a visual pass too.

## Phase 5 — Remaining portal routes

Every sidebar link now resolves to a real page under `src/app/dashboard/`, reusing `PortalShell`.
`/dashboard` is gated: its layout calls `requireUser()` (`src/auth/cookies.ts`), so a signed-out
visitor lands on `/login` before any of this renders. Two depth tiers:

- [x] **Real, backed by fixture/DB data**: Today's Mock (`/dashboard/today` — the app's original
      `/` home page, moved here and restyled to the dashboard's card system: "start something new"
      is what today's mock *is*), Mock Calendar (`/dashboard/calendar`), All Mocks 1–30
      (`/dashboard/mocks` — `SEED_DASHBOARD.allMocks`, a full 30-row list added for this),
      per-mock Solutions stub (`/dashboard/mocks/[mockNumber]/solutions`), Overall Analysis
      (`/dashboard/analysis`), Subject Analysis (`/dashboard/analysis/subject`), Weak Areas
      (`/dashboard/weak-areas`), Strong Areas (`/dashboard/strong-areas`, new `StrongAreasList`
      component), and Profile (`/dashboard/profile` — the one page reading the real `User` row:
      name, email, member-since date; enrolments and study plan are still fixture).
- [x] **Honest placeholders** (`ComingSoonScreen`, real routes, not 404s — see it for why this
      isn't "half-finished"): Performance, Previous Mocks, Compare Performance, Topic Analysis,
      Practice Zone, Topic Tests, Previous Year Papers, Bookmarks, Settings, Help & Support.
- [ ] Leaderboard (`1k`) — not yet a route; no nav item points at it either (the mockup's sidebar
      doesn't list it as a top-level item, only screen `1k` shows it standalone).
- [ ] Give the placeholders real content, in roughly the order the mockup numbers their screens:
      Overall/Subject/Topic Analysis already real; Practice Zone & Topic Tests (`1i`), Previous
      Year Papers + Bookmarks (`1j`) next. Each will need its own schema additions in
      `src/dashboard/types.ts` (`PracticeMode`, `PreviousYearPaper`, `BookmarkedQuestion`,
      `LeaderboardEntry`).
- [x] `MocksTable` (renamed from `RecentMocksTable`) is now the one component behind both the
      dashboard-home "Recent mocks" preview and the full "All Mocks" page — took a `heading` and
      optional `headerRight` instead of being hardcoded to one or the other.

## Phase 6 — Future: real data layer (not built now)

Replace `SEED_DASHBOARD` with live data once the backend exists. Not finalised, but the working
assumption is Postgres for relational/transactional records (candidates, enrollments, attempts,
streak state, leaderboard rank) and MongoDB for flexible/large content (question bank, per-attempt
analysis blobs). API routes under `src/app/api/dashboard/*` would sit in front of both, so
`DashboardScreen` and its children never change — only what constructs the fixture object does.
