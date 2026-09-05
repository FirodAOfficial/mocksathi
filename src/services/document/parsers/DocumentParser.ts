import type { DocumentFormat, DocumentModel } from '../types';

/** Everything a parser is given. Deliberately free of any HTTP concepts. */
export interface ParserInput {
  bytes: Uint8Array;
  filename: string | null;
  contentType: string | null;
  sourceUrl: string | null;
}

/**
 * One implementation per supported source format.
 *
 * Parsers are pure byte-in / model-out. They never fetch, never touch the DOM,
 * and never know an editor exists — which is what lets them be unit-tested
 * directly and reused from a server-side conversion pipeline later.
 */
export interface DocumentParser {
  readonly format: DocumentFormat;
  parse(input: ParserInput): Promise<DocumentModel>;
}
