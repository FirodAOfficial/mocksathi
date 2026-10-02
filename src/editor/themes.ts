/**
 * The Design tab's themes, colour sets and style sets.
 *
 * All three change the same four things — the heading font, its colour, its
 * weight and whether it is set in capitals — so they are one shape here rather
 * than three. Word presents them as three controls because they came from
 * three places; what they do overlaps almost entirely.
 *
 * This is *presentation*, not content. Applying a theme changes how the page
 * draws its headings, exactly as the page colour and the watermark do. It
 * writes nothing into the document, so nothing here can move a paragraph, a
 * character offset or anything the marker reads. A question that asks for a
 * heading in a particular colour is answered with the Font colour, which is a
 * mark on the text and is marked as one.
 */

export interface HeadingStyle {
  font: string;
  colour: string;
  weight: 400 | 600 | 700;
  caps: boolean;
}

/** Word's default: Cambria headings in its blue, unbolded. */
export const DEFAULT_HEADING_STYLE: HeadingStyle = {
  font: 'Cambria, Georgia, serif',
  colour: '#365f91',
  weight: 400,
  caps: false,
};

export interface DocumentTheme {
  id: string;
  label: string;
  /** Applied to the body as well, through `setDocumentFont`. */
  bodyFont: string;
  heading: HeadingStyle;
}

export const THEMES: DocumentTheme[] = [
  {
    id: 'office',
    label: 'Office',
    bodyFont: 'Calibri',
    heading: DEFAULT_HEADING_STYLE,
  },
  {
    id: 'facet',
    label: 'Facet',
    bodyFont: 'Trebuchet MS',
    heading: { font: 'Trebuchet MS, sans-serif', colour: '#2e7d32', weight: 700, caps: false },
  },
  {
    id: 'ion',
    label: 'Ion',
    bodyFont: 'Century Gothic',
    heading: { font: 'Century Gothic, sans-serif', colour: '#b85c38', weight: 700, caps: true },
  },
  {
    id: 'retrospect',
    label: 'Retrospect',
    bodyFont: 'Calibri',
    heading: { font: 'Georgia, serif', colour: '#4a4a4a', weight: 600, caps: false },
  },
  {
    id: 'slice',
    label: 'Slice',
    bodyFont: 'Times New Roman',
    heading: { font: 'Times New Roman, serif', colour: '#1f4e79', weight: 700, caps: false },
  },
  {
    id: 'wisp',
    label: 'Wisp',
    bodyFont: 'Verdana',
    heading: { font: 'Verdana, sans-serif', colour: '#a5382c', weight: 400, caps: true },
  },
];

/** Word's theme colours: the heading colour alone, the rest left as it is. */
export const THEME_COLOURS: { id: string; label: string; colour: string }[] = [
  { id: 'blue', label: 'Blue', colour: '#365f91' },
  { id: 'grey', label: 'Grey', colour: '#44546a' },
  { id: 'green', label: 'Green', colour: '#2e7d32' },
  { id: 'red', label: 'Red', colour: '#a5382c' },
  { id: 'orange', label: 'Orange', colour: '#b85c38' },
  { id: 'purple', label: 'Purple', colour: '#6a3d9a' },
];

/**
 * The gallery across the middle of the Design tab.
 *
 * Word calls these style sets, and what they change is the look of a heading
 * against the same body text — which is why each one previews as "Title" over
 * "Heading 1" rather than as a swatch.
 */
export interface StyleSet {
  id: string;
  label: string;
  heading: HeadingStyle;
}

export const STYLE_SETS: StyleSet[] = [
  { id: 'default', label: 'Default', heading: DEFAULT_HEADING_STYLE },
  {
    id: 'lines',
    label: 'Lines',
    heading: { font: 'Calibri, sans-serif', colour: '#365f91', weight: 700, caps: false },
  },
  {
    id: 'shaded',
    label: 'Shaded',
    heading: { font: 'Calibri, sans-serif', colour: '#1f4e79', weight: 700, caps: true },
  },
  {
    id: 'casual',
    label: 'Casual',
    heading: { font: 'Trebuchet MS, sans-serif', colour: '#44546a', weight: 600, caps: false },
  },
  {
    id: 'formal',
    label: 'Formal',
    heading: { font: 'Georgia, serif', colour: '#000000', weight: 400, caps: true },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    heading: { font: 'Arial, sans-serif', colour: '#000000', weight: 700, caps: false },
  },
];

/**
 * The CSS custom properties a heading style becomes.
 *
 * Named rather than inlined so the page, the gallery previews and any test can
 * all ask the same function what a style looks like — a preview that drifted
 * from what applying it does would be worse than no preview.
 */
export function headingStyleVars(style: HeadingStyle): Record<string, string> {
  return {
    '--doc-heading-font': style.font,
    '--doc-heading-colour': style.colour,
    '--doc-heading-weight': String(style.weight),
    '--doc-heading-caps': style.caps ? 'uppercase' : 'none',
  };
}
