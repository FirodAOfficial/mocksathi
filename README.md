# Mocksathi

A browser-based Word-style document editor and exam player, plus a candidate dashboard for
tracking mock-test performance. Built on Next.js (App Router).

## Prerequisites

- Node.js 20+ and npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the database — see below)

## Setup

```bash
npm install
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000). Key routes:

- `/` — entry point (sample exam, open a `.docx`, or a blank document)
- `/exam` — exam instructions and player
- `/editor` — the document editor
- `/result` — result and solutions screens (design preview, `?outcome=qualified|not-qualified`)
- `/dashboard` — candidate dashboard (mock calendar, streak, performance)
- `/signup`, `/login` — create an account / sign in (see [Database](#database) — needs Postgres running)

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
npm run db:up              # starts Postgres via docker compose (needs Docker Desktop running)
npm run db:migrate         # applies db/migrations/ to it
```

`DATABASE_URL` in `.env` points the app at that database. Other database scripts:

```bash
npm run db:generate   # after changing src/db/schema.ts, writes a new file into db/migrations/
npm run db:studio      # Drizzle Studio — browse/edit tables in the browser
npm run db:down         # stops the container (data persists in its volume; add -v to wipe it)
```

Migrations are checked-in SQL files under `db/migrations/`, generated from `src/db/schema.ts` —
edit the schema, then run `db:generate`, review the generated SQL, and commit both.

### Auth

`src/auth/` has the account/session logic behind `/signup`, `/login`, and the dashboard's Logout
nav item: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, and
`GET /api/auth/me`. Sessions are DB-backed (a row per session, in `sessions`) rather than
stateless JWTs, so logout is an actual delete, not just a client-side cookie clear. Passwords are
hashed with Node's built-in `crypto.scrypt` — no extra dependency, no native module to compile.
