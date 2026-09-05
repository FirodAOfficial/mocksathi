import JSZip from 'jszip';

/**
 * Builds a real .docx in memory.
 *
 * The parser's job is to read the OOXML that Word actually writes, so the tests
 * assemble genuine zip packages rather than stubbing the XML layer. That keeps
 * the tests honest about the zip handling, the part lookup and the namespace
 * prefixes, all of which are places this could plausibly break.
 */
export interface DocxFixtureParts {
  documentBody: string;
  styles?: string;
  numbering?: string;
  theme?: string;
  coreProperties?: string;
  /** Omits `word/document.xml` entirely, as a non-Word OOXML package would. */
  omitDocument?: boolean;
}

const WORD_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

export async function buildDocx(parts: DocxFixtureParts): Promise<Uint8Array> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
  );

  if (!parts.omitDocument) {
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${WORD_NS}><w:body>${parts.documentBody}</w:body></w:document>`,
    );
  }

  if (parts.styles) zip.file('word/styles.xml', parts.styles);
  if (parts.numbering) zip.file('word/numbering.xml', parts.numbering);
  if (parts.theme) zip.file('word/theme/theme1.xml', parts.theme);
  if (parts.coreProperties) zip.file('docProps/core.xml', parts.coreProperties);

  return zip.generateAsync({ type: 'uint8array' });
}

export function stylesXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><w:styles ${WORD_NS}>${body}</w:styles>`;
}

export function numberingXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><w:numbering ${WORD_NS}>${body}</w:numbering>`;
}

/** A bullet list at level 0 and an ordered list at level 0, as numId 1 and 2. */
export const STANDARD_NUMBERING = numberingXml(`
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl>
    <w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
`);

export const STANDARD_STYLES = stylesXml(`
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:color w:val="365F91"/><w:sz w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/></w:style>
`);

/** Wraps runs in a `w:p`, optionally with paragraph properties. */
export function paragraph(runs: string, properties = ''): string {
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${runs}</w:p>`;
}

export function run(text: string, properties = ''): string {
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}
