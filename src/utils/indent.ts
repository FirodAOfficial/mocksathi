/**
 * How far one indent level moves a paragraph, in CSS pixels.
 *
 * Word's default tab stop is half an inch, which is 48 px at 96 dpi.
 *
 * This lives outside the editor because both sides of the app need it: the
 * ribbon's Increase/Decrease Indent buttons apply it, and the marking key on
 * the server checks for it. The editor extension that owns the attribute pulls
 * in Tiptap, which has no business in a server bundle.
 */
export const INDENT_STEP_PX = 48;

/** Word stops indenting somewhere; ten levels is well past any sane document. */
export const MAX_INDENT_PX = INDENT_STEP_PX * 10;
