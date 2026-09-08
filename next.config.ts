import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dashboard is the app's front door; anyone hitting bare "/" lands
  // there (and, if signed out, on from there to /login — see
  // src/auth/cookies.ts's requireUser).
  async redirects() {
    return [{ source: '/', destination: '/dashboard', permanent: false }];
  },
  // The document proxy is the only route allowed to reach the network. Everything
  // else is static. A strict CSP keeps document-provided markup inert even if it
  // were ever to escape sanitisation.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
