import type { Editor } from '@tiptap/react';

/**
 * The Insert tab's commands, and the rules the pictures one has to enforce.
 *
 * Separate from `ribbonActions.ts` because these put *content* into the
 * document rather than formatting what is already there — and because the
 * picture rules below are worth testing without an editor.
 */

/**
 * The largest picture a candidate may insert, in bytes of the chosen file.
 *
 * A picture has nowhere to be uploaded to: the answer is one JSON payload
 * submitted at the end, so the image travels inside it as a data URL, which is
 * about a third larger again than the file. 2 MB of file is roughly 2.7 MB of
 * payload — enough for a photograph, and well short of a submission large
 * enough to be refused or to time out on an exam-hall connection.
 */
export const MAX_PICTURE_BYTES = 2 * 1024 * 1024;

/** What a picture may be. Word accepts more; a browser renders these. */
export const PICTURE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

export type PictureRejection = 'too-large' | 'wrong-type';

/**
 * Whether a chosen file may be inserted, and why not when it may not.
 *
 * Checked before the file is read, so a 50 MB picture is refused immediately
 * rather than after the browser has turned it into 67 MB of base64.
 */
export function checkPicture(file: { size: number; type: string }): PictureRejection | null {
  if (!PICTURE_TYPES.includes(file.type)) return 'wrong-type';
  if (file.size > MAX_PICTURE_BYTES) return 'too-large';
  return null;
}

export function pictureRejectionMessage(reason: PictureRejection): string {
  return reason === 'too-large'
    ? `That picture is larger than ${Math.round(MAX_PICTURE_BYTES / (1024 * 1024))} MB. Choose a smaller one.`
    : 'That file is not a picture. Choose a PNG, JPEG, GIF, WebP or SVG.';
}

/** Reads a chosen file as the data URL the `image` node stores in `src`. */
export function readPictureDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The picture could not be read.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function insertPicture(editor: Editor, src: string, alt: string): void {
  editor.chain().focus().setImage({ src, alt }).run();
}

/**
 * A shape or an icon, as an inline SVG data URL.
 *
 * The same `image` node a picture uses, rather than a node type of its own:
 * one way to carry a picture means one thing for the serialiser, the marker
 * and the clipboard to understand, and a shape a candidate inserted is a
 * picture as far as the document is concerned.
 */
export function insertVectorArt(editor: Editor, svg: string, label: string): void {
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  insertPicture(editor, src, label);
}

/**
 * Normalises what a candidate typed into the Link dialog.
 *
 * `www.example.com` is what people type and is not a URL. A bare address with
 * an `@` is an email. Anything already carrying a scheme is left alone, and
 * anything that is still not parseable comes back null so the dialog can say
 * so rather than writing a dead link into the paper.
 */
export function normaliseLinkHref(raw: string): string | null {
  const text = raw.trim();
  if (text.length === 0) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text)
    ? text
    : text.includes('@') && !text.includes('/')
      ? `mailto:${text}`
      : `https://${text}`;

  try {
    const url = new URL(withScheme);
    // Only the three the schema allows; `javascript:` must never reach a link.
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function applyLink(editor: Editor, href: string, text?: string): void {
  const chain = editor.chain().focus();

  // Nothing selected: the link needs something to sit on, so the address —
  // or the label the candidate gave — is written and then linked.
  if (editor.state.selection.empty) {
    const label = text?.trim() || href;
    chain.insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] }).run();
    return;
  }

  chain.extendMarkRange('link').setLink({ href }).run();
}

export function removeLink(editor: Editor): void {
  editor.chain().focus().extendMarkRange('link').unsetLink().run();
}

export function insertHorizontalLine(editor: Editor): void {
  editor.chain().focus().setHorizontalRule().run();
}

/** Word's Date & Time, in the format its default "long date" uses. */
export function insertDateTime(editor: Editor, now: Date = new Date()): void {
  editor
    .chain()
    .focus()
    .insertContent(now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))
    .run();
}
