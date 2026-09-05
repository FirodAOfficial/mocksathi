/**
 * Every failure the document pipeline can produce, as a closed set.
 *
 * The UI renders an error state per code, so codes are the contract between
 * the loading layer and `DocumentErrorOverlay`. Adding a failure mode means
 * adding a code and a message here, not a string thrown from a random module.
 */
export type DocumentErrorCode =
  | 'INVALID_URL'
  | 'BLOCKED_URL'
  | 'NETWORK_ERROR'
  | 'HTTP_ERROR'
  | 'TIMEOUT'
  | 'TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'PARSE_FAILED'
  | 'EMPTY_DOCUMENT';

interface ErrorPresentation {
  title: string;
  message: string;
}

const PRESENTATION: Record<DocumentErrorCode, ErrorPresentation> = {
  INVALID_URL: {
    title: 'Invalid document address',
    message:
      'The docUrl provided is not a valid http or https web address. Check the address and open the editor again.',
  },
  BLOCKED_URL: {
    title: 'Document address not allowed',
    message:
      'This address points at a private or internal network location, which the editor will not request.',
  },
  NETWORK_ERROR: {
    title: 'Unable to reach the document',
    message:
      'The document could not be retrieved. The server may be offline, or the address may no longer exist.',
  },
  HTTP_ERROR: {
    title: 'Unable to load the document',
    message: 'The server refused the request for this document.',
  },
  TIMEOUT: {
    title: 'The document took too long to load',
    message: 'The server did not respond in time. It may be busy or the document may be very large.',
  },
  TOO_LARGE: {
    title: 'Document is too large',
    message: 'This document exceeds the size this editor can open.',
  },
  UNSUPPORTED_TYPE: {
    title: 'Unsupported document type',
    message: 'This editor opens .docx files. The address provided is a different kind of file.',
  },
  PARSE_FAILED: {
    title: 'The document could not be read',
    message:
      'The file was retrieved but its contents could not be interpreted. It may be corrupt or incomplete.',
  },
  EMPTY_DOCUMENT: {
    title: 'This document is empty',
    message: 'The document loaded successfully but contains no content.',
  },
};

export class DocumentError extends Error {
  readonly code: DocumentErrorCode;
  /** Short heading for the error overlay. */
  readonly title: string;
  /** Sentence shown to the user. Never contains a stack or raw server text. */
  readonly userMessage: string;
  /** Extra technical context (status code, filename). Shown as small print. */
  readonly detail?: string;

  constructor(code: DocumentErrorCode, detail?: string) {
    const presentation = PRESENTATION[code];
    super(`${code}: ${presentation.message}${detail ? ` (${detail})` : ''}`);
    this.name = 'DocumentError';
    this.code = code;
    this.title = presentation.title;
    this.userMessage = presentation.message;
    this.detail = detail;
  }
}

export function isDocumentError(value: unknown): value is DocumentError {
  return value instanceof DocumentError;
}

/** Narrows anything thrown into a DocumentError so the UI always has a code. */
export function toDocumentError(value: unknown, fallback: DocumentErrorCode): DocumentError {
  if (isDocumentError(value)) return value;
  if (value instanceof Error && value.name === 'AbortError') return new DocumentError('TIMEOUT');
  return new DocumentError(fallback, value instanceof Error ? value.message : undefined);
}
