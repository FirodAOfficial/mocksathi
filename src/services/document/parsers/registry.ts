import { DocumentError } from '../errors';
import type { DetectedFormat } from '../detectFormat';
import type { DocumentParser } from './DocumentParser';
import { DocxDocumentParser } from './docx/DocxDocumentParser';
import { TxtDocumentParser } from './TxtDocumentParser';

/**
 * Format -> parser. The only place that knows which formats exist.
 *
 * Supporting a new format means writing a `DocumentParser` and adding one line
 * here; nothing in the loader or the editor changes.
 */
const PARSERS = new Map<DetectedFormat, DocumentParser>([
  ['docx', new DocxDocumentParser()],
  ['txt', new TxtDocumentParser()],
]);

export function resolveParser(format: DetectedFormat): DocumentParser {
  const parser = PARSERS.get(format);
  if (parser) return parser;

  if (format === 'doc') {
    // Word 97-2003 is an OLE2 compound binary, an entirely different format
    // from OOXML. Reading it needs a server-side converter, so it is reported
    // precisely rather than being attempted and failing obscurely.
    throw new DocumentError(
      'UNSUPPORTED_TYPE',
      'Legacy .doc files (Word 97-2003) need conversion to .docx before they can be opened.',
    );
  }

  throw new DocumentError('UNSUPPORTED_TYPE', 'The file is not a Word document.');
}

export function supportedFormats(): DetectedFormat[] {
  return [...PARSERS.keys()];
}
