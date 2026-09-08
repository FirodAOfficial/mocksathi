import type { NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

/**
 * Keeps the Supabase session alive.
 *
 * Named `proxy` in a file called `proxy.ts`: Next 16 deprecates the
 * `middleware` convention and warns on every dev start until it is moved.
 *
 * A refresh token has to be exchanged before it expires, and only a response
 * can carry the new cookies back — so it happens here, on the way through,
 * rather than in a server component, which cannot set them.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Every path except the ones that can never hold a session: Next's build
     * output, image optimiser, favicon, and static assets. Running on those
     * would spend a token refresh on each image the page loads.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
