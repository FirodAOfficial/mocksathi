import { createServerClient } from '@supabase/ssr';
import type { cookies } from 'next/headers';
import { supabaseKey, supabaseUrl } from './env';

/**
 * The Supabase client for server components, route handlers and actions.
 *
 * The cookie store is passed in rather than read here so the caller owns the
 * `await cookies()` — a server component and a route handler get it at
 * different points, and this stays usable from both.
 */
export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) =>
  createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components cannot set cookies. Ignored on purpose: the
          // middleware below refreshes the session on the way through, so the
          // write this call would have made has already happened there.
        }
      },
    },
  });
