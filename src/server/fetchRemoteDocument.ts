import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ALLOWED_CONTENT_TYPES } from '@/services/document/detectFormat';
import { DocumentError } from '@/services/document/errors';
import { validateDocumentUrl } from '@/services/document/validateUrl';
import { isBlockedAddress } from './ipRules';

/**
 * The single place this application is allowed to reach the public internet.
 *
 * Responsibilities, in order: prove the destination is a public host, cap how
 * long we will wait, cap how much we will read, and hand back opaque bytes.
 * It never parses the document — that happens in the parser layer, and keeping
 * it out of the request path means a malicious file cannot influence routing.
 */

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 3;

/** Types that are definitely not a document, rejected before download. */
const REJECTED_CONTENT_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'application/javascript',
  'text/javascript',
]);

export interface RemoteDocument {
  bytes: Uint8Array;
  contentType: string | null;
  filename: string | null;
}

export async function fetchRemoteDocument(rawUrl: string): Promise<RemoteDocument> {
  let current = validateDocumentUrl(rawUrl).url;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertPublicHost(current);

      let response: Response;
      try {
        response = await fetch(current, {
          signal: controller.signal,
          // Redirects are followed by hand so each new destination goes through
          // the same host check — `redirect: 'follow'` would let hop 2 land on
          // 169.254.169.254 without ever being inspected.
          redirect: 'manual',
          headers: { accept: '*/*', 'user-agent': 'MockSathi-DocumentProxy/1.0' },
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw new DocumentError('TIMEOUT');
        throw new DocumentError('NETWORK_ERROR', error instanceof Error ? error.message : undefined);
      }

      if (isRedirect(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new DocumentError('HTTP_ERROR', `Redirect without a location (${response.status}).`);
        current = new URL(location, current);
        // A redirect to a non-http scheme (file:, gopher:) is a classic bypass.
        validateDocumentUrl(current.toString());
        continue;
      }

      if (!response.ok) {
        throw new DocumentError('HTTP_ERROR', `The server responded with ${response.status}.`);
      }

      return await readBody(response, current);
    }

    throw new DocumentError('HTTP_ERROR', 'Too many redirects.');
  } finally {
    clearTimeout(timeout);
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * Resolves the hostname and refuses non-public destinations.
 *
 * Known residual risk: a hostile DNS server can answer differently between this
 * check and the connection ("DNS rebinding"). Closing that hole requires
 * pinning the connection to the address checked here via a custom dispatcher,
 * which is documented as deferred work rather than pretended to be solved.
 */
async function assertPublicHost(url: URL): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  const literalFamily = isIP(hostname);
  if (literalFamily !== 0) {
    if (isBlockedAddress(hostname, literalFamily === 4 ? 4 : 6)) {
      throw new DocumentError('BLOCKED_URL', 'The address resolves to a non-public network.');
    }
    return;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new DocumentError('NETWORK_ERROR', `The host "${hostname}" could not be resolved.`);
  }

  if (addresses.length === 0) {
    throw new DocumentError('NETWORK_ERROR', `The host "${hostname}" has no addresses.`);
  }

  // Every resolved address must be public: a host that returns one public and
  // one private address would otherwise be usable to reach the private one.
  for (const { address, family } of addresses) {
    if (isBlockedAddress(address, family === 4 ? 4 : 6)) {
      throw new DocumentError('BLOCKED_URL', 'The address resolves to a non-public network.');
    }
  }
}

async function readBody(response: Response, url: URL): Promise<RemoteDocument> {
  const contentType = response.headers.get('content-type');
  const baseType = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';

  if (REJECTED_CONTENT_TYPES.has(baseType)) {
    throw new DocumentError('UNSUPPORTED_TYPE', `The server returned ${baseType}.`);
  }
  // An unknown type is tolerated because misconfigured servers are common; the
  // magic-number check in `detectDocumentFormat` is the authoritative test.
  if (baseType !== '' && !ALLOWED_CONTENT_TYPES.has(baseType) && !baseType.startsWith('application/')) {
    throw new DocumentError('UNSUPPORTED_TYPE', `The server returned ${baseType}.`);
  }

  const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DOCUMENT_BYTES) {
    throw new DocumentError('TOO_LARGE', `The document is ${Math.round(declaredLength / 1024 / 1024)} MB.`);
  }

  const bytes = await readCapped(response);
  if (bytes.length === 0) throw new DocumentError('EMPTY_DOCUMENT', 'The server returned no content.');

  return { bytes, contentType, filename: deriveFilename(response, url) };
}

/**
 * Reads the body incrementally and stops the moment the cap is exceeded, so a
 * server lying about (or omitting) content-length cannot exhaust memory.
 */
async function readCapped(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > MAX_DOCUMENT_BYTES) {
      await reader.cancel();
      throw new DocumentError('TOO_LARGE', 'The document exceeds the 25 MB limit.');
    }
    chunks.push(value);
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function deriveFilename(response: Response, url: URL): string | null {
  const disposition = response.headers.get('content-disposition');
  const match = disposition ? /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition) : null;
  if (match?.[1]) {
    try {
      // Strip any path components: the value is attacker-controlled and is only
      // ever used for display and extension sniffing.
      return decodeURIComponent(match[1]).split(/[\\/]/).pop() ?? null;
    } catch {
      return match[1];
    }
  }

  const name = url.pathname.split('/').pop();
  return name && name !== '' ? decodeURIComponent(name) : null;
}

export const PROXY_LIMITS = {
  timeoutMs: REQUEST_TIMEOUT_MS,
  maxBytes: MAX_DOCUMENT_BYTES,
  maxRedirects: MAX_REDIRECTS,
} as const;
