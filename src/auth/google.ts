import 'server-only';

/**
 * Google OAuth 2.0 mechanics — no Next.js or DB code here, same reasoning as
 * `src/auth/session.ts` staying framework-free. Plain `fetch` against
 * Google's REST endpoints, no OAuth client library: there's exactly one
 * provider and one flow (the "authorization code" grant), which doesn't
 * carry enough incidental complexity to justify a dependency.
 *
 * The ID token JWT is deliberately never parsed here. Verifying it by hand
 * means fetching Google's JWKS, matching the key id, and checking signature +
 * issuer + audience + expiry — real places to get something subtly wrong.
 * Calling the userinfo endpoint with the access token instead has Google do
 * that verification; the response is just JSON.
 */

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

function clientId(): string {
  const value = process.env.GOOGLE_CLIENT_ID;
  if (!value) throw new Error('GOOGLE_CLIENT_ID is not set. Copy .env.example to .env and fill it in.');
  return value;
}

function clientSecret(): string {
  const value = process.env.GOOGLE_CLIENT_SECRET;
  if (!value) throw new Error('GOOGLE_CLIENT_SECRET is not set. Copy .env.example to .env and fill it in.');
  return value;
}

/** Where Google sends the browser back to, after the consent screen — same value used to request and to redeem the code. */
export function googleRedirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

/** The URL to send the browser to, to start the consent screen. `state` is the caller's CSRF token, echoed back verbatim on the callback. */
export function googleAuthorizationUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    // Always show the account chooser rather than silently reusing whichever
    // Google account happens to be signed in in this browser.
    prompt: 'select_account',
  });
  return `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/** Redeems the authorization code from the callback for an access token. */
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<string> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const body = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.error ?? 'Google did not return an access token.');
  }
  return body.access_token;
}

export interface GoogleUserInfo {
  /** Google's stable per-account id — the real join key, not email (see `users.googleId`). */
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
}

/** The signed-in Google account's identity — verified by Google itself, not by us parsing a token. */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('Could not fetch the Google account profile.');
  return (await response.json()) as GoogleUserInfo;
}
