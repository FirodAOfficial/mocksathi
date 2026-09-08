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
      email/password rather than the mockup's phone/OTP, per the auth-method decision above; no
      "Continue with Google" button, since that isn't wired up. First pass used the editor's
      Office-blue theme instead — corrected after review.
- [x] Dashboard's "Logout" nav item (previously a dead `Link` to `/logout`) now calls
      `POST /api/auth/logout` and redirects to `/login`.
- [x] End-to-end verified against the real local database: signup → `/api/auth/me` returns the
      user → duplicate signup 409s → logout → `/api/auth/me` returns `null` → wrong password 401s →
      correct login issues a new session. Confirmed via `psql` that logout actually deletes the
      session row, not just the cookie.
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
  methods alongside email/password rather than a replacement for it.
- Session listing / "sign out of all devices" (trivial once wanted — it's just `DELETE FROM
  sessions WHERE user_id = ...`).
- Roles/permissions, once there's more than one kind of account.
