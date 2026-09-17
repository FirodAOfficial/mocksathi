import { ImageResponse } from 'next/og';

/**
 * The favicon — Next.js's file-based icon convention picks this up
 * automatically (no `<link>` tag or `metadata.icons` entry needed).
 *
 * Drawn from the same path data as `BrandLogo`'s mark
 * (`src/components/site/BrandLogo.tsx`) rather than a binary asset, same
 * reasoning that file gives for why it has no logo file to begin with:
 * there is one definition of the mark, not a second copy that can drift out
 * of sync with it. Update both together if the mark ever changes.
 */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <svg width={32} height={32} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="11" fill="#1c6ef2" />
        <path
          d="M10 28.5V11.5h4.2l5.8 8.6 5.8-8.6H30v17h-4.1V18.4l-5.9 8.6-5.9-8.6v10.1z"
          fill="#fff"
        />
      </svg>
    ),
    { ...size },
  );
}
