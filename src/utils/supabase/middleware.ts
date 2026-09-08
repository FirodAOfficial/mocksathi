import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseKey, supabaseUrl } from './env';

/**
 * Refreshes the Supabase session on every request and returns the response
 * carrying the refreshed cookies.
 *
 * The `getUser()` call is the point of this function, not a check: Supabase
 * refreshes an expiring token as a side effect of it, and writes the new
 * cookies through `setAll`. Without it this would forward cookies unchanged and
 * sessions would simply expire — which is why it is named for what it does
 * rather than being called `createClient` like its siblings.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseKey(), {
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

  return supabaseResponse;
}
