import type { DocumentModel } from '../types';
import { createParagraph } from '../types';
import type { DocumentParser, ParserInput } from './DocumentParser';

/**
 * Plain text.
 *
 * Small enough to be uninteresting on its own — it exists to keep the registry
 * honestly multi-format, so adding RTF or ODT later is a registration rather
 * than a refactor.
 */
export class TxtDocumentParser implements DocumentParser {
  readonly format = 'txt' as const;

  async parse(input: ParserInput): Promise<DocumentModel> {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(input.bytes);
    const lines = text.replace(/\r\n?/g, '\n').split('\n');

    return {
      metadata: {
        title: input.filename?.replace(/\.[a-z0-9]+$/i, '') ?? 'Document',
        format: 'txt',
        sourceUrl: input.sourceUrl,
        unsupportedFeatures: [],
      },
      body: lines.map((line) => createParagraph({ runs: line === '' ? [] : [{ text: line, marks: {} }] })),
    };
  }
}
