import type { NormalizedStyleId, ParagraphFormatting, RunFormatting } from '../../types';
import { mergeRunFormatting, parseParagraphProperties, parseRunProperties, type ThemeFonts } from './properties';
import type { UnsupportedFeatureLog } from './unsupported';
import { attr, childrenOf, descend, findChild, parseXml } from './xml';

interface DocxStyle {
  styleId: string;
  name: string;
  basedOn: string | null;
  run: RunFormatting;
  paragraph: Partial<ParagraphFormatting>;
}

/**
 * `styles.xml`, resolved.
 *
 * Word styles form an inheritance chain via `w:basedOn`, and a run's effective
 * formatting is docDefaults -> style chain -> direct formatting. Flattening the
 * chain here means the rest of the parser only ever merges three layers.
 */
export class StyleTable {
  private readonly byId = new Map<string, DocxStyle>();
  private readonly resolvedRun = new Map<string, RunFormatting>();

  readonly defaultRun: RunFormatting;
  readonly defaultParagraph: Partial<ParagraphFormatting>;

  constructor(
    styles: DocxStyle[],
    defaults: { run: RunFormatting; paragraph: Partial<ParagraphFormatting> },
  ) {
    for (const style of styles) this.byId.set(style.styleId.toLowerCase(), style);
    this.defaultRun = defaults.run;
    this.defaultParagraph = defaults.paragraph;
  }

  private get(styleId: string | null): DocxStyle | undefined {
    if (!styleId) return undefined;
    return this.byId.get(styleId.toLowerCase());
  }

  /** Run formatting contributed by a style and everything it is based on. */
  runFormattingFor(styleId: string | null): RunFormatting {
    if (!styleId) return {};
    const key = styleId.toLowerCase();
    const cached = this.resolvedRun.get(key);
    if (cached) return cached;

    const chain: DocxStyle[] = [];
    const seen = new Set<string>();
    let current = this.get(styleId);
    // `basedOn` cycles are malformed but do occur; `seen` keeps this terminating.
    while (current && !seen.has(current.styleId.toLowerCase())) {
      seen.add(current.styleId.toLowerCase());
      chain.unshift(current);
      current = this.get(current.basedOn);
    }

    const resolved = mergeRunFormatting(...chain.map((style) => style.run));
    this.resolvedRun.set(key, resolved);
    return resolved;
  }

  paragraphFormattingFor(styleId: string | null): Partial<ParagraphFormatting> {
    const style = this.get(styleId);
    if (!style) return {};

    const chain: Partial<ParagraphFormatting>[] = [];
    const seen = new Set<string>();
    let current: DocxStyle | undefined = style;
    while (current && !seen.has(current.styleId.toLowerCase())) {
      seen.add(current.styleId.toLowerCase());
      chain.unshift(current.paragraph);
      current = this.get(current.basedOn);
    }

    return Object.assign({}, ...chain) as Partial<ParagraphFormatting>;
  }

  /** The gallery style a Word style maps onto, matched by id then by name. */
  normalize(styleId: string | null, unsupported: UnsupportedFeatureLog): NormalizedStyleId {
    if (!styleId) return 'Normal';
    const direct = normalizeStyleKey(styleId, unsupported);
    if (direct) return direct;

    const style = this.get(styleId);
    const byName = style ? normalizeStyleKey(style.name, unsupported) : null;
    if (byName) return byName;

    // An unrecognised custom style keeps its direct formatting (already merged
    // into the runs) but renders with the body-text block style.
    return 'Normal';
  }
}

const STYLE_ALIASES: Record<string, NormalizedStyleId> = {
  normal: 'Normal',
  bodytext: 'Normal',
  default: 'Normal',
  nospacing: 'NoSpacing',
  heading1: 'Heading1',
  heading2: 'Heading2',
  heading3: 'Heading3',
  title: 'Title',
  subtitle: 'Subtitle',
  quote: 'Quote',
  intensequote: 'Quote',
  blockquote: 'Quote',
};

function normalizeStyleKey(raw: string, unsupported: UnsupportedFeatureLog): NormalizedStyleId | null {
  const key = raw.toLowerCase().replace(/[\s_-]/g, '');
  const alias = STYLE_ALIASES[key];
  if (alias) return alias;

  // Headings 4-9 have no gallery equivalent; clamping keeps the outline shape
  // rather than silently demoting them to body text.
  const deepHeading = /^heading([4-9])$/.exec(key);
  if (deepHeading) {
    unsupported.add('Headings below level 3 were converted to Heading 3.');
    return 'Heading3';
  }

  return null;
}

export function parseThemeFonts(themeXml: string | null): ThemeFonts {
  if (!themeXml) return { major: null, minor: null };
  try {
    const root = parseXml(themeXml);
    const scheme = descend(root, 'theme', 'themeElements', 'fontScheme');
    const read = (slot: string): string | null => {
      const node = findChild(scheme, slot);
      if (!node) return null;
      const latin = findChild(childrenOf(node), 'latin');
      return latin ? (attr(latin, 'typeface') ?? null) : null;
    };
    return { major: read('majorFont'), minor: read('minorFont') };
  } catch {
    // A malformed theme is not worth failing the whole document over.
    return { major: null, minor: null };
  }
}

export function parseStyles(
  stylesXml: string | null,
  themeFonts: ThemeFonts,
  unsupported: UnsupportedFeatureLog,
): StyleTable {
  if (!stylesXml) return new StyleTable([], { run: {}, paragraph: {} });

  const root = parseXml(stylesXml);
  const stylesRoot = descend(root, 'styles');

  const docDefaultsNode = findChild(stylesRoot, 'docDefaults');
  const docDefaults = docDefaultsNode ? childrenOf(docDefaultsNode) : [];
  const rPrDefault = findChild(docDefaults, 'rPrDefault');
  const pPrDefault = findChild(docDefaults, 'pPrDefault');

  const defaultRun = parseRunProperties(
    rPrDefault ? findChild(childrenOf(rPrDefault), 'rPr') : undefined,
    themeFonts,
    unsupported,
  );
  const defaultParagraph = parseParagraphProperties(
    pPrDefault ? findChild(childrenOf(pPrDefault), 'pPr') : undefined,
    unsupported,
  ).formatting;

  const styles: DocxStyle[] = [];
  for (const node of stylesRoot) {
    const styleId = attr(node, 'styleId');
    if (!styleId) continue;
    const kids = childrenOf(node);
    const nameNode = findChild(kids, 'name');
    const basedOnNode = findChild(kids, 'basedOn');

    styles.push({
      styleId,
      name: nameNode ? (attr(nameNode, 'val') ?? styleId) : styleId,
      basedOn: basedOnNode ? (attr(basedOnNode, 'val') ?? null) : null,
      run: parseRunProperties(findChild(kids, 'rPr'), themeFonts, unsupported),
      paragraph: parseParagraphProperties(findChild(kids, 'pPr'), unsupported).formatting,
    });
  }

  return new StyleTable(styles, { run: defaultRun, paragraph: defaultParagraph });
}

export type { DocxStyle };
