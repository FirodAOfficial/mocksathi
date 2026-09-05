import type { DocumentFormat } from './types';

/**
 * Identify a document by its content, not its name.
 *
 * Filenames, URL extensions, and `Content-Type` headers are all attacker- or
 * misconfiguration-controlled, so they are used only as a tie-breaker. The
 * primary signal is the magic number at the head of the file.
 */

/** `PK\x03\x04` — every OOXML file is a zip. */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
/** `\xD0\xCF\x11\xE0` — OLE2 compound file, i.e. legacy binary Word 97-2003. */
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((byte, index) => bytes[index] === byte);
}

export type DetectedFormat = DocumentFormat | 'unknown';

export interface DetectionInput {
  bytes: Uint8Array;
  contentType?: string | null;
  filename?: string | null;
}

export function detectDocumentFormat({ bytes, contentType, filename }: DetectionInput): DetectedFormat {
  if (bytes.length === 0) return 'unknown';

  if (startsWith(bytes, ZIP_MAGIC)) {
    // A .docx is a zip, but so is .xlsx, .pptx, and a plain .zip. The zip
    // parser confirms the actual part layout; here we only say "OOXML-shaped".
    return 'docx';
  }

  if (startsWith(bytes, OLE2_MAGIC)) {
    // Legacy binary .doc. Recognised so the user gets an accurate message
    // rather than a generic parse failure; see README for why it is not read.
    return 'doc';
  }

  const normalizedType = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  const extension = (filename ?? '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';

  if (normalizedType === 'text/plain' || extension === 'txt') return 'txt';

  return 'unknown';
}

/** Content types the proxy is willing to relay. */
export const ALLOWED_CONTENT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/octet-stream',
  'application/zip',
  'binary/octet-stream',
  'text/plain',
]);
