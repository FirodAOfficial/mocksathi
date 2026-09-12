'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isLegalPath, recordLegalHop, rememberLegalEntry } from './legalCloseTracking';

export interface LegalNavLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
}

/**
 * A `<Link>` to a legal/about page that tracks how many steps the close
 * button needs to jump back. Clicked from `/dashboard/profile` or the auth
 * pages' `SiteFooter` (outside the cluster), it resets the count to one step.
 * Clicked from `SiteFooter` on another legal page (hopping from Terms to
 * Privacy, say — the current page is already a legal page), it adds one more
 * step instead, so the close button ends up skipping every intermediate hop
 * in a single native back-navigation.
 */
export function LegalNavLink({ href, className, children }: LegalNavLinkProps) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        if (isLegalPath(pathname)) recordLegalHop();
        else rememberLegalEntry();
      }}
    >
      {children}
    </Link>
  );
}
