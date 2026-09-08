// @vitest-environment node
// Middleware runs on the server: jsdom's Headers is not the one
// `NextResponse.next({ request })` requires.
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateSession } from './middleware';

/**
 * The deployment that produced MIDDLEWARE_INVOCATION_FAILED had no Supabase
 * environment variables: `.env` and `.env.local` are gitignored, so a fresh
 * Vercel project has neither. This ran on every route, so throwing here took
 * the whole site down rather than degrading one feature.
 */

const URL_VAR = 'NEXT_PUBLIC_SUPABASE_URL';
const KEY_VAR = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';

afterEach(() => vi.unstubAllEnvs());

const request = () => new NextRequest('https://example.com/editor');

describe('updateSession', () => {
  it('passes the request through when Supabase is not configured', async () => {
    vi.stubEnv(URL_VAR, '');
    vi.stubEnv(KEY_VAR, '');

    const response = await updateSession(request());
    expect(response.status).toBe(200);
  });

  it('passes through when only one of the two is set', async () => {
    vi.stubEnv(URL_VAR, 'https://project.supabase.co');
    vi.stubEnv(KEY_VAR, '');

    await expect(updateSession(request())).resolves.toBeDefined();
  });

  it('does not fail the request when Supabase cannot be reached', async () => {
    vi.stubEnv(URL_VAR, 'https://project.supabase.co');
    vi.stubEnv(KEY_VAR, 'sb_publishable_test');
    // A session cookie the SDK will try to refresh against a host that is not
    // there: the visitor still gets their page.
    vi.stubGlobal('fetch', () => Promise.reject(new Error('network down')));

    const response = await updateSession(request());
    expect(response.status).toBe(200);
  });
});
