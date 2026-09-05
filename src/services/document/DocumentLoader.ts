import { detectDocumentFormat } from './detectFormat';
import { DocumentError, toDocumentError } from './errors';
import { resolveParser } from './parsers/registry';
import { isDocumentEmpty, type DocumentModel } from './types';
import { validateDocumentUrl } from './validateUrl';

/** Raw bytes plus whatever the transport learned about them. */
export interface DocumentSource {
  bytes: Uint8Array;
  contentType: string | null;
  filename: string | null;
}

/**
 * How bytes are obtained. The editor never fetches anything itself.
 *
 * The default implementation goes through this app's own proxy route, because
 * an arbitrary document host will not send CORS headers and a direct browser
 * fetch would fail for most real URLs. Swapping in a transport that reads from
 * a CDN, a storage bucket, or a test fixture is a constructor argument.
 */
export interface DocumentTransport {
  fetch(url: string, signal: AbortSignal): Promise<DocumentSource>;
}

export interface DocumentLoader {
  load(rawUrl: string, options?: { signal?: AbortSignal }): Promise<DocumentModel>;
}

/** Client-side ceiling; the proxy enforces its own, lower, limit. */
const DEFAULT_TIMEOUT_MS = 30_000;

export class ProxyDocumentTransport implements DocumentTransport {
  constructor(private readonly endpoint = '/api/document') {}

  async fetch(url: string, signal: AbortSignal): Promise<DocumentSource> {
    let response: Response;
    try {
      response = await globalThis.fetch(`${this.endpoint}?url=${encodeURIComponent(url)}`, {
        signal,
        headers: { accept: 'application/octet-stream' },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new DocumentError('TIMEOUT');
      throw new DocumentError('NETWORK_ERROR', error instanceof Error ? error.message : undefined);
    }

    if (!response.ok) {
      // The proxy reports the precise reason (blocked host, upstream 404,
      // wrong type) as a JSON body so the UI can show the right state.
      throw await readProxyError(response);
    }

    const buffer = await response.arrayBuffer();
    return {
      bytes: new Uint8Array(buffer),
      contentType: response.headers.get('x-document-content-type'),
      filename: response.headers.get('x-document-filename'),
    };
  }
}

async function readProxyError(response: Response): Promise<DocumentError> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'code' in body) {
      const { code, detail } = body as { code: string; detail?: string };
      return new DocumentError(code as DocumentError['code'], detail);
    }
  } catch {
    // Non-JSON error body; fall through to a status-derived error.
  }
  return new DocumentError('HTTP_ERROR', `The proxy responded with ${response.status}.`);
}

/**
 * URL -> bytes -> format -> parser -> normalised model.
 *
 * Each step is a separate, replaceable collaborator, and every failure exits as
 * a `DocumentError` carrying a code the UI can render.
 */
export class UrlDocumentLoader implements DocumentLoader {
  constructor(
    private readonly transport: DocumentTransport = new ProxyDocumentTransport(),
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async load(rawUrl: string, options: { signal?: AbortSignal } = {}): Promise<DocumentModel> {
    const { href } = validateDocumentUrl(rawUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onExternalAbort);

    try {
      const source = await this.transport.fetch(href, controller.signal);

      if (source.bytes.length === 0) throw new DocumentError('EMPTY_DOCUMENT', 'The file is zero bytes.');

      const format = detectDocumentFormat({
        bytes: source.bytes,
        contentType: source.contentType,
        filename: source.filename,
      });

      const parser = resolveParser(format);
      const model = await parser.parse({
        bytes: source.bytes,
        filename: source.filename,
        contentType: source.contentType,
        sourceUrl: href,
      });

      if (isDocumentEmpty(model)) throw new DocumentError('EMPTY_DOCUMENT');

      return model;
    } catch (error) {
      throw toDocumentError(error, 'PARSE_FAILED');
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onExternalAbort);
    }
  }
}
