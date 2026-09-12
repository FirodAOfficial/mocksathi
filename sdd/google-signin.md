# Google Sign-In — plan

Adds "Continue with Google" to `/login` and `/signup`, alongside the existing email/password flow
— not a replacement for it, matching the backlog item in `sdd/auth.md` ("Phone + OTP sign-in and
'Continue with Google' ... as additional methods alongside email/password"). Written before
implementing, same convention as `sdd/dashboard.md`/`sdd/auth.md` started with.

## Decisions

- **Extends the existing custom session system, doesn't replace it.** This app's auth is
  DB-backed sessions over its own `users` table (`src/auth/`), not Supabase Auth — the
  `NEXT_PUBLIC_SUPABASE_*` keys in `.env` are unrelated to login today. A Google sign-in still ends
  at the same `createSession`/`setSessionCookie` (`src/auth/session.ts`, `src/auth/cookies.ts`)
  every other login path uses, so `requireUser()`/`requireAdmin()` and every gated route keep
  working unchanged — Google is just a new way to arrive at a session, not a parallel identity
  system to reconcile.
- **Hand-rolled OAuth via `fetch`, no new dependency.** Google's OAuth 2.0 endpoints are plain
  REST; this mirrors the existing choice of Node's built-in `crypto.scrypt` over `bcrypt` (avoid a
  dependency, in that case a native one) specifically to keep the dependency surface small.
- **Verify the account via Google's userinfo endpoint, not by parsing the ID token JWT by hand.**
  Hand-verifying a JWT means fetching Google's JWKS, matching the key ID, and checking signature +
  issuer + audience + expiry — a real place to get something subtly wrong. Calling
  `https://openidconnect.googleapis.com/v1/userinfo` with the access token sidesteps all of that:
  Google does the verification, the response is just JSON.
- **Account linking is by verified email**, not a separate "is this a Google account" flag that
  blocks matching. Google only returns an email in the userinfo response once `email_verified` is
  true, so a Google sign-in whose email matches an existing `users` row is treated as the same
  person, not a conflict — same account, new way to reach it. If `email_verified` is false, the
  attempt is rejected rather than silently trusting an unverified address. **The email is run
  through the same `normalizeEmail` (trim + lowercase) signup/login already use** before any
  lookup or insert — missed in the first pass, since Google's emails happen to already be lowercase
  in practice, but that's not a guarantee this app controls, and comparing an unnormalized value
  against the always-normalized `users.email` would miss an existing account on a casing mismatch
  and create a second row for the same real-world email, defeating the whole point of the unique
  constraint. `users.email` staying `UNIQUE` regardless is the actual backstop either way —
  verified directly: a second signup attempt for the same email, in a different case, still 409s.
- **`users.passwordHash` becomes nullable.** It's `NOT NULL` today (`src/db/schema.ts:19`) — a
  Google-only account never sets a password, so this has to relax. Existing password-based login
  is unaffected: `verifyPassword` only ever runs when `passwordHash` is present, and a `NULL` there
  now unambiguously means "no password set", which also becomes the check `POST /api/auth/login`
  uses to give a clear error if someone who signed up via Google later tries the password form.
- **New `users.googleId` column** (`text`, unique, nullable) — Google's stable `sub` claim from the
  userinfo response. This is the actual join key on repeat Google logins, not the email (an email
  can theoretically be reused across Google accounts over long timescales; `sub` never is).
- **CSRF via a `state` parameter**, generated per attempt and stashed in a short-lived, httpOnly
  cookie before redirecting to Google, checked against what Google echoes back on the callback.
  Standard OAuth practice; not optional.
- **Redirect URI is environment-dependent**: `http://localhost:3000/api/auth/google/callback`
  locally, `https://www.mocksathi.com/api/auth/google/callback` in production — both registered on
  the same Google OAuth client, app builds whichever one matches where it's actually running rather
  than hardcoding one.

## What's built

- [x] **Migration** (`db/migrations/0006_sour_jack_flag.sql`): `passwordHash` -> nullable,
      `googleId` (unique, nullable) added to `users`. One unambiguous migration — `drizzle-kit
      generate` didn't need disambiguating here, unlike the `enrollments`/`subscriptions` rename in
      `sdd/subscriptions.md`.
- [x] **Update — `users.avatarUrl`** (`db/migrations/0007_gray_whizzer.sql`): captures Google's
      `picture` field on account creation, and on linking an existing email/password account *only
      if it has no photo yet* — a later Google sign-in never overwrites a photo the user uploaded
      themselves via `POST /api/profile/avatar` (`src/utils/supabase/admin.ts`, Supabase Storage).
      Same field either way; the profile page and the topbar both just render whatever's there.
- [x] **`src/auth/google.ts`** (`server-only`): `googleAuthorizationUrl`, `googleRedirectUri`,
      `exchangeGoogleCode`, `fetchGoogleUserInfo` — the OAuth mechanics, no Next.js- or DB-specific
      code, mirroring how `src/auth/session.ts` stays framework-free.
- [x] **`src/db/googleAuth.ts`**: `findOrCreateUserByGoogle` — looks up by `googleId` first, then
      links an existing email/password account by verified email, then creates a new row as a last
      resort. Returns `{ user, isNewUser }`: the `isNewUser` flag matters because
      `subscribeUserToDefaultPlan` must only run for a genuinely new account — running it on every
      Google sign-in would silently downgrade an existing paid subscriber back to free each time
      they logged in via Google. Handles the race where two concurrent first-time sign-ins for the
      same account both try to insert, via `isUniqueViolation` + a re-read.
- [x] **`GET /api/auth/google`**: generates `state` (`crypto.randomBytes`), stores it via the new
      `setGoogleStateCookie` (`src/auth/cookies.ts`), redirects to Google's consent screen with
      `prompt=select_account` (always shows the account chooser rather than silently reusing
      whatever Google account happens to be signed into the browser).
- [x] **`GET /api/auth/google/callback`**: verifies `state` via `consumeGoogleStateCookie`
      (read-and-clear, single-use), exchanges the code, fetches the profile, rejects an unverified
      email outright, calls `findOrCreateUserByGoogle`, then the same
      `createSession`/`setSessionCookie` every other login path uses, redirects to `/dashboard`.
      Every failure mode (state mismatch, exchange failure, profile fetch failure, unverified email)
      redirects to `/login?error=<code>` rather than throwing a raw 500 at the user.
- [x] **`POST /api/auth/login`** updated: a `NULL` `passwordHash` now gets a specific
      `NO_PASSWORD_SET` error ("This account signs in with Google...") instead of either crashing
      `verifyPassword` on a null argument or falling into the generic wrong-password message.
- [x] **UI**: `GoogleButton` (`src/components/auth/`) on both `LoginForm` and `SignupForm`, above a
      divider, linking to `/api/auth/google`. On signup specifically it renders disabled until the
      Terms/Privacy checkbox is checked (`agreed` state) — Google sign-up still has to go through
      the same consent gate as the email form, not around it. `googleErrorMessage` maps the
      callback's `?error=` codes to what the card displays, read server-side in
      `login`/`signup`'s `page.tsx` via `searchParams` and passed down as a prop (not
      `useSearchParams()` client-side, to avoid a Suspense-boundary requirement for no benefit).
- [x] **Auth-security-review**: `GET /api/auth/google` and `GET /api/auth/google/callback` added to
      the skill's public-routes table with "why public / why still safe" filled in for both.
- [x] **Env**: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` added to `.env`/`.env.example` (empty
      until real Google Cloud Console credentials are filled in — the routes throw a clear "not
      set" error if called before that, same pattern as `DATABASE_URL`'s check in
      `src/db/client.ts`).
- [x] **Verified**: `tsc`/`eslint` clean; existing email/password login and signup unaffected
      (curled against a real account after the migration); `/api/auth/google/callback` with a
      missing/bad `state` redirects to `/login?error=google_state_mismatch` rather than crashing;
      `/login` and `/signup` both render the Google button, divider, and (via `?error=`) the mapped
      error message.

## Open questions

- **What happens if someone signs up with email/password, then later clicks "Continue with
  Google" using a different email than their account?** Under the email-linking decision above,
  that creates a second `users` row rather than merging — is that acceptable, or does account
  merging (by an authenticated "link your Google account" flow from Profile settings, not by
  auto-matching at sign-in) belong in a later pass?
- **OAuth consent screen "Testing" vs "Published" status.** While the consent screen is in Testing
  mode, only explicitly-added test users can complete the flow — anyone else gets blocked by
  Google before reaching the callback at all. Moving to Published for real users needs to happen
  before this ships to anyone outside the team, though it doesn't require Google's full
  verification review at this scope (no sensitive/restricted scopes requested).
- ~~Production domain isn't fixed yet~~ — resolved: **`https://www.mocksathi.com`**. Register both
  redirect URIs on the same OAuth client from the start:
  `http://localhost:3000/api/auth/google/callback` (local dev — Google allows plain `http://` for
  `localhost` specifically, a special exception to OAuth's usual HTTPS-only rule) and
  `https://www.mocksathi.com/api/auth/google/callback` (production). Same for Authorized JavaScript
  origins: `http://localhost:3000` and `https://www.mocksathi.com`. The app needs to build whichever
  redirect URI matches where it's actually running rather than hardcoding one — derived from the
  request in dev, and from a `NEXT_PUBLIC_APP_URL`-style env var (or the request's own host, if
  that's trusted) in production.

## Not in scope for this pass

- Phone/OTP sign-in (separate backlog item in `sdd/auth.md`).
- An explicit "link your Google account" flow from an already-authenticated session — see the
  open question above.
- Automated tests — same standing deferral as every other `sdd/*.md` doc.
