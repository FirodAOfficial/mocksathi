# Mocksathi

A browser-based Word-style document editor and exam player, plus a candidate dashboard for
tracking mock-test performance. Built on Next.js (App Router).

## Prerequisites

- Node.js 24+ (LTS) and npm — some dependencies (`@supabase/supabase-js`, `@supabase/storage-js`)
  require Node ≥22; the project runs on 24 in practice
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the database — see below)

> **Windows + `nvm-windows` note:** if `npm install` fails with `TypeError: Class extends value
> undefined is not a constructor or null`, `C:\Program Files\nodejs` (the symlink nvm-windows
> maintains) is pointing at a stale/corrupted version folder — `node --version` can still report
> the right number while npm's own internals resolve from the wrong place. Fix from an **elevated**
> terminal (nvm's symlink switch needs UAC, which fails silently, not loudly, if you're not
> elevated):
> ```
> nvm use 24.21.0
> ```
> If that doesn't visibly change anything, do it by hand in the same elevated terminal:
> ```
> rmdir "C:\Program Files\nodejs"
> mklink /D "C:\Program Files\nodejs" "C:\Users\<you>\AppData\Roaming\nvm\v24.21.0"
> ```
> Verify with `where node` (not just `node --version`) — it should resolve to the path you just
> linked, and `npm ls` in this repo should run without the crash above.

## Setup

```bash
npm install
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000), which redirects to `/dashboard` —
needs [Database](#database) set up and running, since `/dashboard/*` requires being signed in.
Key routes:

- `/dashboard` — candidate dashboard: streak, mock calendar, performance, and every screen linked
  from its sidebar (`sdd/dashboard.md`)
- `/dashboard/today` — start something: sit the sample exam, open a `.docx`, or a blank document
  (the app's original `/` home page, before the dashboard became the default landing page)
- `/exam` — exam instructions and player
- `/editor` — the document editor
- `/result` — result and solutions screens (design preview, `?outcome=qualified|not-qualified`)
- `/signup`, `/login` — create an account / sign in

## Other scripts

```bash
npm run build       # production build
npm run start        # run a production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run test:watch   # vitest, watch mode
```

> **Known issue (Windows):** `npm test` / `npm run test:watch` can fail with
> `Cannot find module '@rollup/rollup-win32-x64-msvc'` — a known npm optional-dependencies bug
> ([npm/cli#4828](https://github.com/npm/cli/issues/4828)). If you hit it, remove
> `node_modules` and `package-lock.json` and run `npm install` again.

## Database

Postgres backs user accounts and sessions (`src/db/`, migrated with
[Drizzle](https://orm.drizzle.team/)). The dashboard itself still runs on hardcoded fixture data
(`src/dashboard/seedDashboard.ts`) — it isn't wired to the database yet. The planned data layer is
Postgres for relational/transactional data (candidates, enrollments, attempts, streaks) plus
MongoDB for flexible content (question bank, analysis blobs) — not finalised. See
`sdd/dashboard.md` and `sdd/auth.md` for the phased plans.

### Local setup

```bash
cp .env.example .env      # defaults work as-is for local dev
npm run db:up               # starts Postgres + Drizzle Gateway via docker compose (needs Docker Desktop running)
npm run db:migrate          # applies db/migrations/ to it
```

`DATABASE_URL` in `.env` points the app at that database. `SESSION_DURATION_HOURS` (default `1`)
controls how long a session lasts before its cookie/DB row expires and the holder is redirected to
`/login` — every page requires a session now except `/login` and `/signup` themselves. Other
database scripts:

```bash
npm run db:generate   # after changing src/db/schema.ts, writes a new file into db/migrations/
npm run db:studio      # drizzle-kit studio — quick one-off browse via local.drizzle.studio
npm run db:down         # stops both containers (data persists in their volumes; add -v to wipe it)
```

Migrations are checked-in SQL files under `db/migrations/`, generated from `src/db/schema.ts` —
edit the schema, then run `db:generate`, review the generated SQL, and commit both.

### Browsing data live — Drizzle Gateway

`db:up` also starts [Drizzle Gateway](https://gateway.drizzle.team) (`ghcr.io/drizzle-team/gateway`
via `docker-compose.yml`) — a self-hosted Drizzle Studio that keeps running in the background so
you can watch table contents update in real time as the app writes to them, rather than a one-off
snapshot.

1. Open [http://localhost:4983](http://localhost:4983) and sign in with `DRIZZLE_GATEWAY_PASSWORD`
   from `.env` (defaults to `mocksathi`).
2. Add a connection: host `postgres` (the compose network's internal DNS name — not `localhost`),
   port `5432`, and the `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` values from `.env`.
   This is a one-time step per Gateway instance; it's saved in the `drizzle_gateway_data` volume.
3. Browse the `users` and `sessions` tables, edit rows, or watch them change as you sign up, log
   in, and log out through the app.

`npm run db:studio` (`drizzle-kit studio`) is the alternative for a quick look without Docker —
it's driven by `drizzle.config.ts` directly rather than a saved connection, but only runs while the
command is running, in the foreground.

### Auth

`src/auth/` has the account/session logic behind `/signup`, `/login`, and the dashboard's Logout
nav item: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, and
`GET /api/auth/me`. Sessions are DB-backed (a row per session, in `sessions`) rather than
stateless JWTs, so logout is an actual delete, not just a client-side cookie clear. Passwords are
hashed with Node's built-in `crypto.scrypt` — no extra dependency, no native module to compile.
