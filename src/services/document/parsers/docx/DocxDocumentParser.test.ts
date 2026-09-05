import { describe, expect, it } from 'vitest';
import {
  STANDARD_NUMBERING,
  STANDARD_STYLES,
  buildDocx,
  paragraph,
  run,
  stylesXml,
} from '@/test/docxFixture';
import { DocumentError } from '../../errors';
import type { ParagraphBlock } from '../../types';
import { DocxDocumentParser } from './DocxDocumentParser';

const parser = new DocxDocumentParser();

async function parse(body: string, extra: Parameters<typeof buildDocx>[0] extends never ? never : Partial<Parameters<typeof buildDocx>[0]> = {}) {
  const bytes = await buildDocx({
    documentBody: body,
    styles: STANDARD_STYLES,
    numbering: STANDARD_NUMBERING,
    ...extra,
  });
  return parser.parse({ bytes, filename: 'report.docx', contentType: null, sourceUrl: null });
}

const firstBlock = (blocks: ParagraphBlock[]): ParagraphBlock => {
  const block = blocks[0];
  if (!block) throw new Error('expected at least one block');
  return block;
};

describe('DocxDocumentParser', () => {
  it('reads text and character formatting', async () => {
    const model = await parse(
      paragraph(
        run('Bold', '<w:b/>') +
          run('Italic', '<w:i/>') +
          run('Under', '<w:u w:val="single"/>') +
          run('Struck', '<w:strike/>'),
      ),
    );

    const marks = firstBlock(model.body).runs.map((textRun) => textRun.marks);
    expect(marks).toEqual([{ bold: true }, { italic: true }, { underline: true }, { strike: true }]);
  });

  it('normalises fonts, sizes and colours, dropping values equal to the document default', async () => {
    const model = await parse(
      paragraph(
        run('Default', '') +
          run('Big red Arial', '<w:rFonts w:ascii="Arial"/><w:sz w:val="48"/><w:color w:val="FF0000"/>'),
      ),
    );

    const [plain, styled] = firstBlock(model.body).runs;
    // Calibri 11pt is the docDefault, so it is not repeated on every run.
    expect(plain?.marks).toEqual({});
    expect(styled?.marks).toEqual({ fontFamily: 'Arial', fontSize: 24, color: '#ff0000' });
  });

  it('maps named highlights to hex and treats run shading as a highlight', async () => {
    const model = await parse(
      paragraph(run('Yellow', '<w:highlight w:val="yellow"/>') + run('Shaded', '<w:shd w:fill="00FF00"/>')),
    );

    const runs = firstBlock(model.body).runs;
    expect(runs[0]?.marks.highlight).toBe('#ffff00');
    expect(runs[1]?.marks.highlight).toBe('#00ff00');
  });

  it('resolves style inheritance into run formatting', async () => {
    const model = await parse(paragraph(run('Title text'), '<w:pStyle w:val="Heading1"/>'));

    const block = firstBlock(model.body);
    expect(block.styleId).toBe('Heading1');
    expect(block.headingLevel).toBe(1);
    // 28 half-points and the colour both come from the style, not the run.
    expect(block.runs[0]?.marks).toMatchObject({ fontSize: 14, color: '#365f91' });
  });

  it('converts twips to pixels for indentation and spacing', async () => {
    const model = await parse(
      paragraph(
        run('Indented'),
        '<w:jc w:val="center"/><w:ind w:left="720" w:hanging="360"/><w:spacing w:before="240" w:after="120" w:line="276" w:lineRule="auto"/>',
      ),
    );

    expect(firstBlock(model.body).paragraph).toMatchObject({
      align: 'center',
      indentLeft: 48, // 720 twips = half an inch = 48 px
      indentFirstLine: -24, // a hanging indent is a negative first line
      spaceBefore: 16,
      spaceAfter: 8,
      lineHeight: 1.15, // 276/240
    });
  });

  it('reports fixed line spacing instead of approximating it', async () => {
    const model = await parse(paragraph(run('Exact'), '<w:spacing w:line="360" w:lineRule="exact"/>'));

    expect(firstBlock(model.body).paragraph.lineHeight).toBeNull();
    expect(model.metadata.unsupportedFeatures.join(' ')).toContain('Fixed line spacing');
  });

  it('resolves list membership through the numbering indirection', async () => {
    const model = await parse(
      paragraph(run('Bullet'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>') +
        paragraph(run('Nested'), '<w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr>') +
        paragraph(run('Number'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>'),
    );

    expect(model.body.map((block) => block.list)).toEqual([
      { kind: 'bullet', level: 0 },
      { kind: 'bullet', level: 1 },
      { kind: 'ordered', level: 0 },
    ]);
  });

  it('keeps hyperlink text and reports the lost target', async () => {
    const model = await parse(paragraph(`<w:hyperlink r:id="rId5">${run('Click here')}</w:hyperlink>`));

    expect(firstBlock(model.body).runs[0]?.text).toBe('Click here');
    expect(model.metadata.unsupportedFeatures.join(' ')).toContain('Hyperlinks');
  });

  it('flattens tables rather than discarding their text', async () => {
    const model = await parse(
      `<w:tbl><w:tr><w:tc>${paragraph(run('Cell A'))}</w:tc><w:tc>${paragraph(run('Cell B'))}</w:tc></w:tr></w:tbl>`,
    );

    expect(model.body.map((block) => block.runs[0]?.text)).toEqual(['Cell A', 'Cell B']);
    expect(model.metadata.unsupportedFeatures.join(' ')).toContain('Tables');
  });

  it('turns w:br into a line break and w:tab into a tab character', async () => {
    const model = await parse(paragraph('<w:r><w:t>One</w:t><w:br/><w:tab/><w:t>Two</w:t></w:r>'));

    const runs = firstBlock(model.body).runs;
    expect(runs.map((textRun) => [textRun.text, textRun.lineBreak ?? false])).toEqual([
      ['One', false],
      ['', true],
      ['\tTwo', false],
    ]);
  });

  it('prefers the core properties title over the filename', async () => {
    const model = await parse(paragraph(run('Body')), {
      coreProperties: `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Quarterly Report</dc:title></cp:coreProperties>`,
    });

    expect(model.metadata.title).toBe('Quarterly Report');
  });

  it('clamps deep headings to level 3 and says so', async () => {
    const model = await parse(paragraph(run('Deep'), '<w:pStyle w:val="Heading5"/>'), {
      styles: stylesXml('<w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/></w:style>'),
    });

    expect(firstBlock(model.body).styleId).toBe('Heading3');
    expect(model.metadata.unsupportedFeatures.join(' ')).toContain('below level 3');
  });

  it('rejects a package with no Word document part as the wrong type', async () => {
    const bytes = await buildDocx({ documentBody: '', omitDocument: true });

    await expect(
      parser.parse({ bytes, filename: 'book.xlsx', contentType: null, sourceUrl: null }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_TYPE' });
  });

  it('refuses XML that declares a DTD, closing off entity expansion attacks', async () => {
    const bytes = await buildDocx({ documentBody: paragraph(run('safe')) });
    const zip = await (await import('jszip')).default.loadAsync(bytes);
    zip.file(
      'word/document.xml',
      `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>&lol2;</w:t></w:r></w:p></w:body></w:document>`,
    );
    const poisoned = await zip.generateAsync({ type: 'uint8array' });

    await expect(
      parser.parse({ bytes: poisoned, filename: 'bomb.docx', contentType: null, sourceUrl: null }),
    ).rejects.toBeInstanceOf(DocumentError);
  });

  it('always produces at least one paragraph to type into', async () => {
    const model = await parse('<w:sectPr/>');
    expect(model.body).toHaveLength(1);
  });
});
