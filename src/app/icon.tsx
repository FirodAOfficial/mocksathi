import { ImageResponse } from 'next/og';

/**
 * The favicon — Next.js's file-based icon convention picks this up
 * automatically (no `<link>` tag or `metadata.icons` entry needed).
 *
 * The same geometry as `BrandLogo`'s mark (`src/components/site/BrandLogo.tsx`)
 * rather than a binary asset. It is copied rather than imported because
 * `ImageResponse` renders outside React's module graph and cannot use a
 * component or a CSS module — so this is the one duplicate of the mark that
 * exists, and the two change together.
 *
 * The cut-outs are painted white here instead of left as holes: a favicon is
 * composited onto a tab strip of unknown colour, and a transparent slot would
 * fill with whatever that happens to be.
 */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <svg width={32} height={32} viewBox="-5 -2 64 96" xmlns="http://www.w3.org/2000/svg">
        <path
          fill="#16316b"
          d="M0 61V9a9 9 0 0 1 18 0 9 9 0 0 1 18 0 9 9 0 0 1 18 0v52q-9 6-18-.5-9 6.5-18 0Q9 67 0 61Z"
        />
        <path fill="#3b4050" d="M0 63q9 6 18-.5 9 6.5 18 0Q45 69 54 63L29.6 90a3.4 3.4 0 0 1-5.2 0Z" />
        <path fill="#fff" d="M16.7 13.3a1.3 1.3 0 0 1 2.6 0v54.9a1.3 1.3 0 0 1-2.6 0z" />
        <path fill="#fff" d="M34.7 13.3a1.3 1.3 0 0 1 2.6 0v54.9a1.3 1.3 0 0 1-2.6 0z" />
      </svg>
    ),
    { ...size },
  );
}
