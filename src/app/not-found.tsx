import type { Metadata } from 'next';
import { getCurrentUser } from '@/auth/cookies';
import { ErrorPage } from '@/components/site/ErrorPage';

export const metadata: Metadata = {
  title: 'Page not found',
  // A 404 has nothing worth indexing, and indexing it would compete with the
  // real pages for the same queries.
  robots: { index: false, follow: false },
};

/**
 * The page for a URL that does not exist.
 *
 * Next.js's default is black text on white reading "This page could not be
 * found", with no mark and no link anywhere. A candidate who mistypes a mock's
 * address sees what looks like the site being down.
 *
 * The way back depends on who is asking: a signed-in candidate wants their
 * dashboard, a signed-out visitor wants to sign in. `getCurrentUser` is the
 * non-redirecting read — `requireUser` would bounce a signed-out visitor to
 * `/login`, turning a 404 into a redirect and losing the explanation.
 */
export default async function NotFound() {
  const user = await getCurrentUser();

  return (
    <ErrorPage
      code="404"
      title="We could not find that page"
      message={
        user
          ? 'The address may have changed, or the link that brought you here may be out of date. Your mocks and results are all still on your dashboard.'
          : 'The address may have changed, or the link that brought you here may be out of date.'
      }
      action={user ? { href: '/dashboard', label: 'Go to Dashboard' } : { href: '/login', label: 'Sign In' }}
    />
  );
}
