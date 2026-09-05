import { DocumentError } from './errors';

/**
 * Shape validation for a user-supplied `docUrl`.
 *
 * This runs on both sides of the proxy. On the client it exists to fail fast
 * with a good message; it is NOT the security boundary. The real network
 * restriction (DNS resolution, private-range rejection, redirect re-checking)
 * lives in `src/server/fetchRemoteDocument.ts`, because anything enforced only
 * in the browser can be bypassed by calling the API route directly.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export interface ValidatedUrl {
  url: URL;
  href: string;
}

export function validateDocumentUrl(raw: string | null | undefined): ValidatedUrl {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new DocumentError('INVALID_URL', 'No address was provided.');
  }

  const trimmed = raw.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new DocumentError('INVALID_URL', 'The address could not be parsed.');
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new DocumentError('INVALID_URL', `The "${url.protocol}" scheme is not supported.`);
  }

  // Credentials in the URL would be forwarded to whatever the address resolves
  // to, including across redirects. Refuse rather than leak them.
  if (url.username !== '' || url.password !== '') {
    throw new DocumentError('INVALID_URL', 'Addresses containing credentials are not accepted.');
  }

  if (url.hostname === '') {
    throw new DocumentError('INVALID_URL', 'The address has no host.');
  }

  return { url, href: url.toString() };
}

/** Non-throwing variant for UI code that only needs a yes/no. */
export function isValidDocumentUrl(raw: string | null | undefined): boolean {
  try {
    validateDocumentUrl(raw);
    return true;
  } catch {
    return false;
  }
}
