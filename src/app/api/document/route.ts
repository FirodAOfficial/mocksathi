import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/auth/cookies';
import { fetchRemoteDocument } from '@/server/fetchRemoteDocument';
import type { DocumentErrorCode } from '@/services/document/errors';
import { toDocumentError } from '@/services/document/errors';

/**
 * Same-origin proxy for remote documents.
 *
 * Two reasons this route exists rather than fetching from the browser:
 * arbitrary document hosts do not send CORS headers, so a direct fetch fails
 * for most real URLs; and the destination needs to be vetted somewhere the user
 * cannot tamper with, which is only true on the server.
 */

// `node:dns` is required for the address check, so this cannot run on the edge.
export const runtime = 'nodejs';
// The response depends entirely on a query parameter pointing at a third-party
// host, so caching it would be both wrong and a cross-user leak.
export const dynamic = 'force-dynamic';

const STATUS_BY_CODE: Record<DocumentErrorCode, number> = {
  INVALID_URL: 400,
  BLOCKED_URL: 403,
  UNSUPPORTED_TYPE: 415,
  TOO_LARGE: 413,
  TIMEOUT: 504,
  NETWORK_ERROR: 502,
  HTTP_ERROR: 502,
  PARSE_FAILED: 422,
  EMPTY_DOCUMENT: 422,
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  await requireUser();
  const target = request.nextUrl.searchParams.get('url');

  try {
    const document = await fetchRemoteDocument(target ?? '');

    return new NextResponse(new Uint8Array(document.bytes), {
      status: 200,
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': String(document.bytes.byteLength),
        // The upstream type and filename inform format detection on the client,
        // but are passed as custom headers so the body itself stays opaque.
        'x-document-content-type': document.contentType ?? '',
        'x-document-filename': document.filename ?? '',
        'cache-control': 'no-store',
        // The bytes are third-party controlled: never let a browser decide to
        // render them as HTML in this origin.
        'content-disposition': 'attachment',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    const documentError = toDocumentError(error, 'NETWORK_ERROR');
    return NextResponse.json(
      { code: documentError.code, detail: documentError.detail ?? null },
      { status: STATUS_BY_CODE[documentError.code] ?? 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
