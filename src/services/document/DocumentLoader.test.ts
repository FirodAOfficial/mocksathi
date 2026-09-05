import { describe, expect, it } from 'vitest';
import { STANDARD_STYLES, buildDocx, paragraph, run } from '@/test/docxFixture';
import { UrlDocumentLoader, type DocumentSource, type DocumentTransport } from './DocumentLoader';
import { DocumentError } from './errors';

class StubTransport implements DocumentTransport {
  constructor(private readonly source: DocumentSource | Error) {}

  async fetch(): Promise<DocumentSource> {
    if (this.source instanceof Error) throw this.source;
    return this.source;
  }
}

const source = (bytes: Uint8Array): DocumentSource => ({
  bytes,
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  filename: 'report.docx',
});

describe('UrlDocumentLoader', () => {
  it('loads bytes, detects the format, and returns a normalised model', async () => {
    const bytes = await buildDocx({ documentBody: paragraph(run('Hello')), styles: STANDARD_STYLES });
    const loader = new UrlDocumentLoader(new StubTransport(source(bytes)));

    const model = await loader.load('https://example.com/report.docx');

    expect(model.metadata.format).toBe('docx');
    expect(model.metadata.sourceUrl).toBe('https://example.com/report.docx');
    expect(model.body[0]?.runs[0]?.text).toBe('Hello');
  });

  it('validates the address before touching the network', async () => {
    let called = false;
    const transport: DocumentTransport = {
      async fetch() {
        called = true;
        return source(new Uint8Array());
      },
    };

    await expect(new UrlDocumentLoader(transport).load('file:///etc/passwd')).rejects.toMatchObject({
      code: 'INVALID_URL',
    });
    expect(called).toBe(false);
  });

  it('reports a zero-byte response as an empty document', async () => {
    const loader = new UrlDocumentLoader(new StubTransport(source(new Uint8Array())));

    await expect(loader.load('https://example.com/a.docx')).rejects.toMatchObject({ code: 'EMPTY_DOCUMENT' });
  });

  it('reports a document with no text as empty rather than opening a blank page', async () => {
    const bytes = await buildDocx({ documentBody: paragraph(run('   ')), styles: STANDARD_STYLES });
    const loader = new UrlDocumentLoader(new StubTransport(source(bytes)));

    await expect(loader.load('https://example.com/a.docx')).rejects.toMatchObject({ code: 'EMPTY_DOCUMENT' });
  });

  it('identifies a legacy .doc by its OLE2 signature and explains the limitation', async () => {
    const ole2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    const loader = new UrlDocumentLoader(new StubTransport(source(ole2)));

    await expect(loader.load('https://example.com/old.doc')).rejects.toMatchObject({
      code: 'UNSUPPORTED_TYPE',
    });
  });

  it('passes a transport failure through with its original code', async () => {
    const loader = new UrlDocumentLoader(new StubTransport(new DocumentError('BLOCKED_URL')));

    await expect(loader.load('https://example.com/a.docx')).rejects.toMatchObject({ code: 'BLOCKED_URL' });
  });

  it('converts an unexpected transport error into a DocumentError', async () => {
    const loader = new UrlDocumentLoader(new StubTransport(new TypeError('socket exploded')));

    const error = await loader.load('https://example.com/a.docx').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DocumentError);
  });
});
