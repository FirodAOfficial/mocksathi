/**
 * Word's underline styles, and how each one is drawn.
 *
 * The ribbon's Underline button is a split button: pressing it underlines with
 * a single line, and its arrow opens this list. The style is an attribute of
 * the underline mark rather than a mark of its own, so a run is underlined
 * once, in one style, in one colour — which is what Word's own model says and
 * what lets a question ask for "double underline" and be marked on it.
 *
 * CSS draws five of these directly. Dash-dot and dash-dot-dot have no
 * `text-decoration-style`, so they are painted as a repeating gradient under
 * the text: the pattern is right, and — unlike a text decoration — it does not
 * break around descenders. That difference is visible if you look for it, and
 * is noted here rather than papered over.
 */

export const UNDERLINE_STYLES = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'thick', label: 'Thick' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dashDot', label: 'Dash-dot' },
  { value: 'dashDotDot', label: 'Dash-dot-dot' },
  { value: 'wavy', label: 'Wavy' },
] as const;

export type UnderlineStyle = (typeof UNDERLINE_STYLES)[number]['value'];

export const UNDERLINE_STYLE_VALUES = UNDERLINE_STYLES.map((style) => style.value);

export function isUnderlineStyle(value: unknown): value is UnderlineStyle {
  return typeof value === 'string' && (UNDERLINE_STYLE_VALUES as string[]).includes(value);
}

export function underlineStyleLabel(style: UnderlineStyle): string {
  return UNDERLINE_STYLES.find((entry) => entry.value === style)?.label ?? style;
}

/** The dash pattern for the two styles CSS cannot draw, as a repeating gradient. */
const PAINTED: Partial<Record<UnderlineStyle, string>> = {
  dashDot: 'repeating-linear-gradient(90deg, CURRENT 0 6px, transparent 6px 9px, CURRENT 9px 11px, transparent 11px 14px)',
  dashDotDot:
    'repeating-linear-gradient(90deg, CURRENT 0 6px, transparent 6px 9px, CURRENT 9px 11px, transparent 11px 14px, CURRENT 14px 16px, transparent 16px 19px)',
};

/**
 * The CSS for one underline style, in one colour.
 *
 * `colour` is `null` for Word's "Automatic", which means the text's own colour
 * — so the declarations simply leave the colour out and let it inherit.
 */
export function underlineCss(style: UnderlineStyle, colour: string | null): string {
  const painted = PAINTED[style];

  if (painted) {
    const ink = colour ?? 'currentColor';
    return [
      'text-decoration: none',
      `background-image: ${painted.replaceAll('CURRENT', ink)}`,
      'background-repeat: repeat-x',
      'background-position: 0 100%',
      'background-size: 100% 1px',
      // Without this the gradient is clipped to the line box and never shows.
      'padding-bottom: 1px',
    ].join('; ');
  }

  const decoration =
    style === 'double' ? 'double' : style === 'dotted' ? 'dotted' : style === 'dashed' ? 'dashed' : style === 'wavy' ? 'wavy' : 'solid';

  return [
    'text-decoration-line: underline',
    `text-decoration-style: ${decoration}`,
    ...(style === 'thick' ? ['text-decoration-thickness: 3px'] : []),
    ...(colour ? [`text-decoration-color: ${colour}`] : []),
    // Word never breaks its underline around a descender.
    'text-decoration-skip-ink: none',
  ].join('; ');
}
