# Auth — implementation plan

Scope for this pass: account creation, login, and logout, backed by a real Postgres database.
Everything else (phone/OTP, Google sign-in, gating `/dashboard` behind a session, roles) is future
work — see the backlog at the bottom.

## Decisions

- **Migrations/ORM: Drizzle** (`drizzle-orm` + `drizzle-kit`). TypeScript-first, stays close to
  plain SQL, doesn't lock in an opinion about how MongoDB would later sit alongside it.
- **Sessions: DB-backed**, not stateless JWT. A `sessions` table row per session means logout is a
  real `DELETE` — immediate, verifiable invalidation — at the cost of one DB lookup per
  authenticated request. Only a SHA-256 hash of the session token is stored; the raw token lives
  only in the browser's `httpOnly` cookie, so a leak of the table alone isn't a replayable session.
- **Auth method: email + password**, not the mockup's phone + OTP + Google (screen `1m` in
  `design/Quiz website UI mockups.zip`). Simplest to build with no external service (OTP delivery
  would need an SMS provider — Twilio/MSG91/etc. — not yet chosen). Phone/OTP and Google can be
  added later as additional sign-in methods without reshaping the `users`/`sessions` schema.
- **Password hashing: Node's built-in `crypto.scrypt`**, not `bcrypt`/`argon2`. Zero new
  dependency, and no native module to compile — worth avoiding specifically on this Windows dev
  box, where a native binding (Rollup's `@rollup/rollup-win32-x64-msvc`) has already failed to
  install once (see `README.md`).
- **Ids are app-generated** (`crypto.randomUUID()`), not database-generated, so no Postgres
  extension (`pgcrypto`/`uuid-ossp`) needs to be enabled on a fresh database.

## What's built

- [x] `docker-compose.yml` — local Postgres, healthcheck, named volume. `npm run db:up` / `db:down`.
      (Postgres 18+'s image wants the volume mounted at `/var/lib/postgresql`, not
      `/var/lib/postgresql/data` — the old convention fails to start; see the comment in the file.)
- [x] `.env.example` (and a local `.env`, gitignored) — `DATABASE_URL` plus the Postgres
      credentials the compose file reads.
- [x] `drizzle.config.ts` — schema at `src/db/schema.ts`, migrations out to `db/migrations/`.
- [x] `src/db/schema.ts` — `users` (id, email unique, password_hash, name, timestamps) and
      `sessions` (id = hashed token, user_id fk on delete cascade, created_at, expires_at).
- [x] `src/db/client.ts` — the `drizzle`/`pg` connection, pooled and kept on `globalThis` so
      `next dev`'s module reloads don't open a fresh pool on every edit.
- [x] `db/migrations/0000_tranquil_hellcat.sql` — generated from the schema above, applied to the
      local database (`npm run db:migrate`); `\dt` confirms both tables exist.
- [x] `src/auth/password.ts` — `hashPassword` / `verifyPassword` (scrypt, timing-safe compare).
- [x] `src/auth/session.ts` — `createSession` / `getUserBySessionToken` / `deleteSession`, DB-only,
      no Next.js imports (keeps it testable without a request context).
- [x] `src/auth/cookies.ts` — the Next.js-specific layer: sets/reads/clears the `mocksathi_session`
      httpOnly cookie, and `getCurrentUser()` for server components/routes that need to know who's
      signed in.
- [x] `src/auth/validation.ts` — email format check, `MIN_PASSWORD_LENGTH` (8), shared by the
      signup route and its client form.
- [x] Route handlers: `POST /api/auth/signup` (creates the account, signs it straight in),
      `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. Login/signup use one
      generic "Incorrect email or password" / not-generic "that email already exists" split — the
      former avoids leaking which emails have accounts, the latter is fine to reveal since it's
      the account owner completing their own signup.
- [x] `/signup`, `/login` pages (`src/components/auth/{Login,Signup}Form.tsx`) — styled to match the
      mockup's sign-in card (screen `1m`): Mocksathi logo, Inter font, `#1c6ef2` accent, rounded
      accent-bordered inputs on focus, same tokens as `PortalShell.module.css` (duplicated in
      `AuthCard.module.css` since these pages render outside `/dashboard`'s layout). Fields are
      email/password rather than the mockup's phone/OTP, per the auth-method decision above. First
      pass used the editor's Office-blue theme instead — corrected after review.
- [x] **Update — "Continue with Google" wired up**, see `sdd/google-signin.md` for the full plan
      and implementation notes.
- [x] Dashboard's "Logout" nav item (previously a dead `Link` to `/logout`) now calls
      `POST /api/auth/logout` and redirects to `/login`.
- [x] **Update — `/login` redesigned as a split screen** (`LoginForm.tsx` restructured;
      new `MarketingPanel.tsx`), from a second reference mockup: dark marketing panel on the left,
      the same email/password card on the right (unchanged fields — kept the email/password
      decision above rather than switching to that mockup's phone/OTP form). The reference claimed
      "365 Mocks Available", an exclusive Rajasthan-government affiliation, and showed the
      Rajasthan Staff Selection Board / High Court emblems — none true of this app, and official
      government insignia is legally restricted in India to reproduce, so none of that made it in:
      the headline ("Master Word & Excel Efficiency with Mocksathi") is honest instead, since that
      genuinely is the exam content (`src/exam/seedAttempt.ts`); the Word/Excel "badges" are
      generic coloured squares, not real (trademarked) Office icons.
- [x] **Update — `/signup` got the same split-screen treatment**, plus a new "Target exam"
      picker (optional, hidden entirely when no exams are published yet) — see `sdd/exams.md`'s
      "signup redesign, exam picker at signup, and a public exams API" update for the full detail,
      including the new public `GET /api/exams` endpoint this needed.
- [x] **Full API auth audit**, prompted directly by "our db should be secure for unauthorised
      access": every route under `src/app/api/**` checked for whether it touches the database and,
      if so, whether it's gated. Result — no gaps. `requireAdmin()`: `/api/admin/exams*`.
      `requireUser()`: `/api/profile/enrollments*`. Public by necessity (this *is* how a session
      gets created/destroyed/checked): `/api/auth/{login,signup,logout,me}` — `logout` and `me`
      only ever act on the caller's own cookie-derived session, never anyone else's data. Public by
      design: `GET /api/exams` (minimal fields, published exams only — see `sdd/exams.md`).
- [x] **Update — every page requires a session now**, including `/exam`, `/editor`, and `/result`
      (previously the deliberate exceptions, mirrored by `/api/attempts/submit` and `/api/document`
      being unauthenticated). All five now call `requireUser()` as their first line — a signed-out
      visitor, or one whose session has expired (`sessions.expires_at` in the past —
      `getUserBySessionToken` already excludes it), is redirected to `/login`, same as every
      `/dashboard/*` route. `/login` and `/signup` are the only page routes left unauthenticated,
      necessarily — you can't require a session to reach the page that creates one. See the updated
      exceptions table in `.claude/skills/auth-security-review/SKILL.md`.
- [x] **Update — session lifetime is now configurable**, `SESSION_DURATION_HOURS` in `.env`
      (`src/auth/session.ts::sessionDurationMs`), default **1 hour** (was a hardcoded 30 days).
      Read fresh on every `createSession()` call rather than cached at module load, so changing it
      doesn't need a code edit — just a dev-server restart to pick up the new `.env` value. An
      expired session is already indistinguishable from no session at all
      (`getUserBySessionToken`'s `gt(sessions.expiresAt, now())` check, unchanged) — shortening the
      default just makes that path exercised far more often.
- [x] End-to-end verified against the real local database: signup → `/api/auth/me` returns the
      user → duplicate signup 409s → logout → `/api/auth/me` returns `null` → wrong password 401s →
      correct login issues a new session. Confirmed via `psql` that logout actually deletes the
      session row, not just the cookie.
- [x] **Update — concurrent-session cap**, `MAX_CONCURRENT_SESSIONS` in `.env`
      (`src/auth/session.ts::maxConcurrentSessions`), default **5**. Enforced inside
      `createSession` itself (in a transaction with the insert), not a separate cleanup job: counts
      the user's *live* sessions (`expiresAt` in the future — an already-expired row doesn't occupy
      a slot), and if adding one more would exceed the cap, evicts the oldest live session(s) first
      so the total never grows past it. A sixth login (default cap) quietly signs the oldest device
      out rather than refusing the new login or letting the table grow without bound.
- [x] `tsc --noEmit` and `eslint` clean on everything touched.

## Not done / deferred

- [ ] Automated tests (`src/auth/*.test.ts`) — holding per the same instruction as
      `sdd/dashboard.md` Phase 4: skip running tests until after database integration lands, and
      `npm test` is separately blocked in this environment by the pre-existing Rollup
      native-binding issue noted in `README.md`.
- [x] ~~`/dashboard` is not gated behind a session~~ — done: `src/app/dashboard/layout.tsx` calls
      `requireUser()`, which redirects a signed-out visitor to `/login` before anything under
      `/dashboard/*` renders (`redirect()` in a layout halts its whole child tree — no per-page
      gating needed, though pages that need the user for their own content call it again anyway;
      `getCurrentUser` is wrapped in React's `cache()` so that's one DB lookup per request, not
      two). `dashboardDataFor(user)` overlays the real name onto the fixture candidate — see
      `sdd/dashboard.md`'s Phase 5 update. Enrolments, streak, mocks etc. are still fixture data.
- [ ] No password reset / email verification / rate limiting on login attempts.

## Backlog (future)

- Phone + OTP sign-in and "Continue with Google", matching mockup screen `1m`, as additional
  methods alongside email/password rather than a replacement for it. Google sign-in has its own
  plan now — see `sdd/google-signin.md`.
- Session listing / "sign out of all devices" as a user-facing feature — the cap now silently
  evicts the oldest session once there are too many, but there's still no UI for someone to see
  which devices are signed in or end one on purpose. Trivial once wanted, same reasoning as
  before: it's just `DELETE FROM sessions WHERE user_id = ...`, targeted instead of automatic.
- Roles/permissions, once there's more than one kind of account.
