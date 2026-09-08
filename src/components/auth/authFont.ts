import { Inter } from 'next/font/google';

/**
 * Auth pages (`/login`, `/signup`) sit outside `/dashboard`'s layout but are
 * its front door, so they use the same Inter font and colour tokens as the
 * candidate portal (see `PortalShell.module.css`) rather than the document
 * editor's Office-style theme in `globals.css`.
 */
export const inter = Inter({ subsets: ['latin'] });
