import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfig } from './env';

/**
 * Refreshes the Supabase session on every request and returns the response
 * carrying the refreshed cookies.
 *
 * The `getUser()` call is the point of this function, not a check: Supabase
 * refreshes an expiring token as a side effect of it, and writes the new
 * cookies through `setAll`. Without it this would forward cookies unchanged and
 * sessions would simply expire — which is why it is named for what it does
 * rather than being called `createClient` like its siblings.
 *
 * It fails open, in both directions. Refreshing a session is a convenience, not
 * a gate — nothing is authorised here — so an unconfigured project or an
 * unreachable Supabase must leave the request untouched rather than throw.
 * A throw in middleware is not one failed request: it is every route on the
 * site returning MIDDLEWARE_INVOCATION_FAILED at once.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const config = supabaseConfig();
  if (!config) return supabaseResponse;

  /*
   * The whole interaction is guarded, not just the refresh. Constructing the
   * client can throw on its own — supabase-js reaches for a global WebSocket
   * for its realtime channel, which not every server runtime provides — and a
   * throw anywhere in here is every route on the site failing at once.
   */
  try {
    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    });

    await supabase.auth.getUser();
  } catch {
    // Unconfigured, unreachable, or a malformed cookie. The visitor keeps the
    // session they arrived with and the page still renders.
  }

  return supabaseResponse;
}
