import JSZip from 'jszip';
import { DocumentError } from '../../errors';
import type {
  DocumentBlock,
  DocumentModel,
  ParagraphBlock,
  ParagraphFormatting,
  RunFormatting,
  TextRun,
} from '../../types';
import { EMPTY_PARAGRAPH_FORMATTING, createParagraph } from '../../types';
import type { DocumentParser, ParserInput } from '../DocumentParser';
import { NumberingTable, parseNumbering } from './numbering';
import {
  mergeRunFormatting,
  parseParagraphProperties,
  parseRunProperties,
  stripDefaults,
  type ThemeFonts,
} from './properties';
import { StyleTable, parseStyles, parseThemeFonts } from './styles';
import { UnsupportedFeatureLog } from './unsupported';
import { childrenOf, descend, findChild, localName, parseXml, tagOf, textOf, type XmlNode } from './xml';

/** Refuse absurd expansion ratios rather than letting a zip bomb exhaust memory. */
const MAX_PART_BYTES = 32 * 1024 * 1024;

const DOCUMENT_PART = 'word/document.xml';

interface DocxParts {
  document: string;
  styles: string | null;
  numbering: string | null;
  theme: string | null;
  core: string | null;
}

export class DocxDocumentParser implements DocumentParser {
  readonly format = 'docx' as const;

  async parse(input: ParserInput): Promise<DocumentModel> {
    const parts = await readParts(input.bytes);
    const unsupported = new UnsupportedFeatureLog();

    let root: XmlNode[];
    try {
      root = parseXml(parts.document);
    } catch (error) {
      throw new DocumentError(
        'PARSE_FAILED',
        error instanceof Error ? error.message : 'The main document part is not well-formed XML.',
      );
    }

    const themeFonts = parseThemeFonts(parts.theme);
    const styles = parseStyles(parts.styles, themeFonts, unsupported);
    const numbering = parseNumbering(parts.numbering);

    const body = descend(root, 'document', 'body');
    const blocks = readBody(body, { styles, numbering, themeFonts, unsupported });

    return {
      metadata: {
        title: readTitle(parts.core) ?? deriveTitle(input),
        format: 'docx',
        sourceUrl: input.sourceUrl,
        unsupportedFeatures: unsupported.list(),
      },
      // A document whose body held only a sectPr still needs a place to type.
      body: blocks.length > 0 ? blocks : [createParagraph()],
    };
  }
}

interface ParseContext {
  styles: StyleTable;
  numbering: NumberingTable;
  themeFonts: ThemeFonts;
  unsupported: UnsupportedFeatureLog;
}

function readBody(body: XmlNode[], context: ParseContext): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  for (const node of body) {
    const tag = tagOf(node);
    if (tag === null) continue;
    const name = localName(tag);

    if (name === 'p') {
      blocks.push(readParagraph(node, context));
    } else if (name === 'tbl') {
      // Tables are not in the model yet. Dropping the element would also drop
      // its text, so the cell paragraphs are flattened into the body and the
      // loss of structure is reported rather than hidden.
      context.unsupported.add('Tables were flattened into ordinary paragraphs.');
      blocks.push(...readTableAsParagraphs(node, context));
    } else if (name === 'sdt') {
      const content = findChild(childrenOf(node), 'sdtContent');
      if (content) blocks.push(...readBody(childrenOf(content), context));
    }
  }

  return blocks;
}

function readTableAsParagraphs(tbl: XmlNode, context: ParseContext): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  for (const row of childrenOf(tbl)) {
    if (localName(tagOf(row) ?? '') !== 'tr') continue;
    for (const cell of childrenOf(row)) {
      if (localName(tagOf(cell) ?? '') !== 'tc') continue;
      blocks.push(...readBody(childrenOf(cell), context));
    }
  }
  return blocks;
}

function readParagraph(node: XmlNode, context: ParseContext): ParagraphBlock {
  const children = childrenOf(node);
  const pPrNode = findChild(children, 'pPr');
  const { formatting: directParagraph, styleId, numbering } = parseParagraphProperties(
    pPrNode,
    context.unsupported,
  );

  const normalizedStyle = context.styles.normalize(styleId, context.unsupported);
  const styleParagraph = context.styles.paragraphFormattingFor(styleId);

  const paragraph: ParagraphFormatting = {
    ...EMPTY_PARAGRAPH_FORMATTING,
    ...context.styles.defaultParagraph,
    ...styleParagraph,
    ...directParagraph,
  };

  // Style-level run formatting applies to every run in the paragraph; direct
  // run properties layer on top of it.
  const styleRun = mergeRunFormatting(
    context.styles.defaultRun,
    context.styles.runFormattingFor(styleId),
  );

  const runs = readRuns(children, styleRun, context);
  const list = numbering ? context.numbering.lookup(numbering.numId, numbering.level) : null;

  const headingLevel =
    normalizedStyle === 'Heading1' ? 1 : normalizedStyle === 'Heading2' ? 2 : normalizedStyle === 'Heading3' ? 3 : null;

  return {
    type: 'paragraph',
    styleId: normalizedStyle,
    headingLevel,
    paragraph,
    list,
    runs,
  };
}

/**
 * Collects the inline content of a paragraph.
 *
 * Runs can be nested inside hyperlinks, tracked-change wrappers and content
 * controls, so this recurses through those containers rather than only reading
 * direct `w:r` children — otherwise linked text silently vanishes.
 */
function readRuns(nodes: XmlNode[], inherited: RunFormatting, context: ParseContext): TextRun[] {
  const runs: TextRun[] = [];

  const walk = (children: XmlNode[]): void => {
    for (const node of children) {
      const tag = tagOf(node);
      if (tag === null) continue;
      const name = localName(tag);

      switch (name) {
        case 'r':
          runs.push(...readRun(node, inherited, context));
          break;
        case 'hyperlink':
          // Hyperlink targets are not in the model yet; the text is kept.
          context.unsupported.add('Hyperlinks were kept as plain text.');
          walk(childrenOf(node));
          break;
        case 'ins':
          // An accepted-looking tracked insertion reads as ordinary text.
          walk(childrenOf(node));
          break;
        case 'del':
          context.unsupported.add('Tracked deletions were removed from the text.');
          break;
        case 'sdt': {
          const content = findChild(childrenOf(node), 'sdtContent');
          if (content) walk(childrenOf(content));
          break;
        }
        case 'smartTag':
          walk(childrenOf(node));
          break;
        default:
          break;
      }
    }
  };

  walk(nodes);
  return runs;
}

function readRun(node: XmlNode, inherited: RunFormatting, context: ParseContext): TextRun[] {
  const children = childrenOf(node);
  const direct = parseRunProperties(findChild(children, 'rPr'), context.themeFonts, context.unsupported);
  const effective = mergeRunFormatting(inherited, direct);
  const marks = stripDefaults(effective, context.styles.defaultRun);

  const pieces: TextRun[] = [];
  let buffer = '';

  const flush = (): void => {
    if (buffer !== '') {
      pieces.push({ text: buffer, marks });
      buffer = '';
    }
  };

  for (const child of children) {
    const tag = tagOf(child);
    if (tag === null) continue;

    switch (localName(tag)) {
      case 't':
        buffer += readTextElement(child);
        break;
      case 'tab':
        buffer += '\t';
        break;
      case 'noBreakHyphen':
        buffer += '‑';
        break;
      case 'softHyphen':
        buffer += '­';
        break;
      case 'br':
        flush();
        pieces.push({ text: '', marks, lineBreak: true });
        break;
      case 'drawing':
      case 'pict':
      case 'object':
        context.unsupported.add('Images and drawings were removed.');
        break;
      default:
        break;
    }
  }

  flush();
  return pieces;
}

/**
 * `<w:t>` text can arrive as a direct value or as child text nodes depending on
 * whether the element carried attributes such as `xml:space`.
 */
function readTextElement(node: XmlNode): string {
  const direct = textOf(node);
  if (direct !== '') return direct;
  return childrenOf(node)
    .map((child) => textOf(child))
    .join('');
}

function readTitle(coreXml: string | null): string | null {
  if (!coreXml) return null;
  try {
    const root = parseXml(coreXml);
    const core = descend(root, 'coreProperties');
    const titleNode = findChild(core, 'title');
    if (!titleNode) return null;
    const value = childrenOf(titleNode)
      .map((child) => textOf(child))
      .join('')
      .trim();
    return value === '' ? null : value;
  } catch {
    return null;
  }
}

function deriveTitle(input: ParserInput): string {
  if (input.filename) return input.filename.replace(/\.[a-z0-9]+$/i, '');
  if (input.sourceUrl) {
    try {
      const name = new URL(input.sourceUrl).pathname.split('/').pop();
      if (name) return decodeURIComponent(name).replace(/\.[a-z0-9]+$/i, '');
    } catch {
      // fall through to the generic title
    }
  }
  return 'Document';
}

async function readParts(bytes: Uint8Array): Promise<DocxParts> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new DocumentError('PARSE_FAILED', 'The file is not a readable Office Open XML package.');
  }

  const documentPart = await readPart(zip, DOCUMENT_PART);
  if (documentPart === null) {
    // A zip without word/document.xml is some other OOXML type (.xlsx, .pptx)
    // or a plain archive — a type problem, not a corruption problem.
    throw new DocumentError('UNSUPPORTED_TYPE', 'The archive does not contain a Word document part.');
  }

  return {
    document: documentPart,
    styles: await readPart(zip, 'word/styles.xml'),
    numbering: await readPart(zip, 'word/numbering.xml'),
    theme: await readPart(zip, 'word/theme/theme1.xml'),
    core: await readPart(zip, 'docProps/core.xml'),
  };
}

async function readPart(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path);
  if (!entry) return null;

  // JSZip exposes the declared uncompressed size before inflating, so an
  // over-large part is rejected without ever materialising it.
  const declaredSize = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (typeof declaredSize === 'number' && declaredSize > MAX_PART_BYTES) {
    throw new DocumentError('TOO_LARGE', `The ${path} part is ${Math.round(declaredSize / 1024 / 1024)} MB.`);
  }

  const content = await entry.async('string');
  if (content.length > MAX_PART_BYTES) {
    throw new DocumentError('TOO_LARGE', `The ${path} part exceeds the supported size.`);
  }
  return content;
}
