import type { JSX } from 'react';

/**
 * Brand and contact marks for the footer and the Contact page.
 *
 * A separate set from `DashboardIcon`, which draws Lucide-style outline icons
 * on a 24x24 grid for the portal nav. These are brand marks — Instagram and
 * YouTube have defined shapes that must be recognisable at 20px, so they are
 * filled paths rather than 1.8px strokes.
 */

export type SocialIconName = 'mail' | 'whatsapp' | 'instagram' | 'youtube';

const PATHS: Record<SocialIconName, JSX.Element> = {
  mail: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3 7 8.1 5.6a1.6 1.6 0 0 0 1.8 0L21 7" />
    </g>
  ),
  whatsapp: (
    <path
      fill="currentColor"
      d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.94L2 22l5.35-1.4a9.8 9.8 0 0 0 4.69 1.2h.01c5.43 0 9.84-4.4 9.84-9.84 0-2.63-1.03-5.1-2.89-6.96A9.77 9.77 0 0 0 12.04 2Zm0 1.79c2.15 0 4.17.84 5.69 2.36a7.99 7.99 0 0 1 2.36 5.69c0 4.45-3.62 8.06-8.06 8.06a8.1 8.1 0 0 1-4.11-1.12l-.3-.18-3.05.8.81-2.98-.19-.3a8 8 0 0 1-1.23-4.28c0-4.45 3.62-8.05 8.08-8.05Zm-2.5 4.2c-.19 0-.5.07-.76.35-.26.28-1 .98-1 2.38s1.02 2.76 1.17 2.95c.14.19 2 3.05 4.85 4.28.68.29 1.2.46 1.62.59.68.22 1.3.19 1.79.11.55-.08 1.68-.68 1.92-1.35.24-.66.24-1.23.17-1.35-.07-.11-.26-.18-.54-.32-.28-.15-1.68-.83-1.94-.92-.26-.1-.45-.14-.64.14-.18.28-.73.92-.9 1.11-.16.19-.33.21-.61.07-.28-.14-1.2-.44-2.28-1.4-.84-.75-1.41-1.68-1.58-1.96-.16-.28-.01-.43.13-.57.13-.13.28-.33.42-.5.14-.17.19-.29.28-.48.1-.19.05-.35-.02-.49-.07-.14-.63-1.54-.87-2.1-.22-.55-.45-.48-.62-.48l-.57-.02Z"
    />
  ),
  instagram: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.2" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.3" cy="6.7" r="1.15" fill="currentColor" stroke="none" />
    </g>
  ),
  youtube: (
    <g fill="currentColor">
      <path d="M22.2 8.2a3.2 3.2 0 0 0-2.25-2.27C18.06 5.42 12 5.42 12 5.42s-6.06 0-7.95.51A3.2 3.2 0 0 0 1.8 8.2C1.3 10.1 1.3 12 1.3 12s0 1.9.5 3.8a3.2 3.2 0 0 0 2.25 2.27c1.89.51 7.95.51 7.95.51s6.06 0 7.95-.51a3.2 3.2 0 0 0 2.25-2.27c.5-1.9.5-3.8.5-3.8s0-1.9-.5-3.8Z" />
      <path fill="#fff" d="M10.05 15.36V8.64L15.77 12l-5.72 3.36Z" />
    </g>
  ),
};

export function SocialIcon({ name, size = 20 }: { name: SocialIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
