---
name: auth-security-review
description: Review or harden authentication, authorization, and database-access code in this app. Use before adding a new API route, a new DB table, a new role-gated feature, or a new piece of user-owned data — and whenever asked to audit, review, or secure the backend/database against unauthorized access.
---

# Auth & DB security review

This app's real security model — established across `src/auth/`, `src/db/`, and every route under
`src/app/api/**` — is short enough to hold in full. Don't re-derive it per task; check new work
against it, and re-run the audit procedure below when asked to review or harden the backend.

## The model

1. **Every route that touches the database must be gated**, unless it's on the short, deliberate
   exceptions list below. Gate with `requireUser()` (any signed-in user) or `requireAdmin()`
   (`role === 'admin'` only) from `src/auth/cookies.ts` — call it as the *first* line of the
   handler, before any DB read or write.
2. **Gate the API route independently of the page**, even when a page already checks. A
   server-component page calling `requireUser()`/`requireAdmin()` protects that page's own render,
   nothing else — the API route it calls is directly reachable by anyone who knows the URL, so it
   needs its own check. (`/dashboard/admin/exams` and `POST /api/admin/exams` each check
   `requireAdmin()` separately; that's the pattern, not redundancy to trim.)
3. **Passwords**: `src/auth/password.ts`, Node's built-in `crypto.scrypt`, never anything hand-rolled,
   never logged, never returned in any response.
4. **Sessions are DB-backed, not stateless.** `sessions.id` stores a SHA-256 hash of the token, never
   the raw token — the raw token exists only in the browser's `httpOnly` cookie. This is what makes
   logout a real, immediate invalidation (`DELETE FROM sessions`), and what makes a leak of the
   `sessions` table alone (a backup, a read replica) not replayable. Never add a code path that
   stores or logs a raw session token.
5. **Error messages must not leak more than necessary.**
   - Login: one generic message ("Incorrect email or password") for both "no such account" and
     "wrong password" — telling them apart lets a caller enumerate which emails have accounts.
   - Admin-only pages/routes: `notFound()` (404) for a non-admin caller, not a redirect or 403 —
     404 says "this doesn't exist", which leaks less than confirming the resource is there but
     forbidden.
   - Signup's "email already exists" is fine to state plainly — the caller is completing their own
     signup, not probing someone else's account.
6. **Roles live on the `users` row** (`role`, checked via `requireAdmin()`), never accepted from the
   client. A request body or query param claiming a role is never trusted for authorization.
7. **Public routes must return the minimum shape needed**, never an internal/admin query reused
   as-is. `GET /api/exams` is the reference: `{ id, name, category }` only, `published` exams only —
   never the full `exams` row (organiser details, links, fees, `createdBy`, etc.), even though
   that richer query already exists in `src/db/enrollments.ts` for other, gated callers.
8. **Postgres unique-violation checks must check `error.cause?.code`, not just `error.code`.**
   drizzle-orm wraps the driver's error in its own `DrizzleQueryError`, with the real `pg` error —
   the one actually carrying `.code` — attached as `.cause`. A naive `error.code === '23505'` check
   silently never matches and falls through to an unhandled 500. Always use the shared
   `src/db/pgErrors.ts::isUniqueViolation`; don't hand-roll another copy (this exact bug happened
   twice — once in `src/db/enrollments.ts`, once in `src/db/examInput.ts` — before being
   consolidated).
9. **Foreign keys to `users` need a deliberate `onDelete`.** `cascade` for data the user owns and
   that should vanish with the account (`sessions`, `enrollments`). `set null` for an audit-trail
   reference that should survive the user being deleted (`exams.createdBy`). Don't leave it
   unspecified.

### Deliberately public routes — the exceptions, and why each is safe

Every *page* route requires a session (`requireUser()`), redirecting a signed-out or expired-session
visitor to `/login` — including `/exam`, `/editor`, and `/result`, which used to be deliberate
exceptions. `/login` and `/signup` are the only unauthenticated pages left, necessarily (you can't
require a session to reach the page that creates one). The three legal documents (Terms, Privacy,
Refund & Cancellation Policy) aren't pages at all — `src/components/legal/LegalDocumentLink`
shows each one in a modal from wherever it's linked (login/signup show Terms + Privacy;
`/dashboard/subscription` shows all three, Refund Policy included, since that's the only place a
purchase happens) — so there was never a route to gate. The remaining public *API* exceptions are
all ones a signed-out visitor genuinely needs to hit:

| Route | Why it's public | Why it's still safe |
|---|---|---|
| `POST /api/auth/login` | Has to be — it's how a session gets created | Rate-limiting/lockout not yet implemented (`sdd/auth.md` "not done") |
| `POST /api/auth/signup` | Same reason | Validates input, generic errors, no privilege escalation possible |
| `POST /api/auth/logout` | Must work even for a stale/expired cookie | Only ever deletes the session named by the caller's *own* cookie |
| `GET /api/auth/me` | Client needs to check its own login state | Returns only the caller's own identity (or `null`), never anyone else's |
| `GET /api/exams` | Signup's exam picker runs before there's a session | Minimal fields, published exams only — see point 7 |
| `GET /api/auth/google` | Has to be — it's how the Google OAuth round trip starts, before there's a session | Only sets a short-lived CSRF `state` cookie and redirects to Google; touches no database table |
| `GET /api/auth/google/callback` | Has to be — Google redirects here with no session established yet | `state` checked against the cookie set by the request above (CSRF); the account it finds/creates is looked up by Google's own verified `sub`/email, never anything client-supplied (`sdd/google-signin.md`) |

`POST /api/attempts/submit` and `GET /api/document` are no longer on this list — now that the pages
that call them (`/exam`, `/editor`) require a session, the routes were gated the same way
(`requireUser()` as their first line) rather than left reachable directly by an unauthenticated
caller. They still touch no database table, but that stopped being the reason they're gated; it's
just no longer a reason they'd need to be public either.

If you're adding a new public route, it must earn a row in this table with the same rigor — "why
public" and "why still safe" both answered, not just the first one.

## Checklist for new work

**New API route:**
- [ ] Does it read or write the database? If yes, first line is `requireUser()` or `requireAdmin()`.
- [ ] If it's public on purpose, what's the minimal response shape, and does it belong in the table
      above with both columns filled in?
- [ ] If it mutates something, does the corresponding page (if any) *also* check auth, independently?

**New DB table:**
- [ ] Any FK to `users`— is `onDelete` `cascade` or `set null`, chosen deliberately?
- [ ] Any unique constraint whose violation the app needs to detect — using
      `src/db/pgErrors.ts::isUniqueViolation`, not a fresh `error.code` check?
- [ ] Any field that becomes part of a *public* route's response later — is it already minimal, or
      will a future public route need to explicitly re-select a subset?

**New role-gated feature:**
- [ ] Gated with `requireAdmin()` (or a future role-specific helper), not a hand-rolled `role ===`
      check scattered inline.
- [ ] 404s for the wrong role, not a redirect or a rendered "forbidden" page.

## Audit procedure

Re-run this whenever asked to review or harden the backend, or after adding several routes in one
pass (as opposed to checking each one inline while writing it):

```bash
# Every route file, its exported handlers, and whether it imports the DB client / an auth guard.
for f in $(find src/app/api -name "route.ts"); do
  echo "=== $f ==="
  grep -n "^export async function\|requireUser\|requireAdmin\|from '@/db" "$f"
  echo
done
```

Read the output per file: any handler whose file imports `@/db` but not `requireUser`/`requireAdmin`
needs justification — either add the missing check, or confirm it belongs in the public-routes
table above with a real reason. Then verify empirically, not just by reading:

```bash
# Every DB-touching route should redirect/404/401 an unauthenticated request.
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/<route>
```

A `307` (redirect to `/login`) or `404` is correct for a gated route hit without a session; a `200`
on a route not in the public-routes table is the bug.
