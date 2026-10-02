import type { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';

/**
 * The References tab's commands, and the document analysis the Review tab's
 * accessibility check runs.
 *
 * The reading half is pure — it takes a document and returns what it found —
 * so what counts as a heading, or as a picture without a description, can be
 * tested without an editor.
 */

export interface HeadingEntry {
  level: number;
  text: string;
}

/** Every heading in the document, in order, with its text flattened. */
export function headingsOf(doc: JSONContent): HeadingEntry[] {
  const found: HeadingEntry[] = [];

  const walk = (node: JSONContent): void => {
    if (node.type === 'heading') {
      const level = Number(node.attrs?.level ?? 1);
      const text = textOf(node).trim();
      if (text.length > 0) found.push({ level, text });
    }
    for (const child of node.content ?? []) walk(child);
  };

  walk(doc);
  return found;
}

function textOf(node: JSONContent): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(textOf).join('');
}

/**
 * Word's Table of Contents, without the page numbers.
 *
 * The numbers are the one part that cannot be honest here: a page number needs
 * pagination, and this document is one continuous sheet. A contents list of
 * the headings is the rest of what the command is for, and it says so in its
 * own heading rather than printing numbers that would be invented.
 */
export function buildTableOfContents(headings: HeadingEntry[]): JSONContent[] {
  if (headings.length === 0) return [];

  return [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Contents' }] },
    ...headings.map((heading) => ({
      type: 'paragraph',
      // Indented by level, which is what makes the list read as a hierarchy
      // without a numbering scheme the document does not have.
      attrs: { indentLeft: (heading.level - 1) * 24 || null },
      content: [{ type: 'text', text: heading.text }],
    })),
  ];
}

export function insertTableOfContents(editor: Editor): number {
  const headings = headingsOf(editor.getJSON());
  const content = buildTableOfContents(headings);
  if (content.length === 0) return 0;

  // At the top, where Word puts it, rather than wherever the caret happens to
  // be — a contents list below the content it lists is not a contents list.
  editor.chain().focus().insertContentAt(0, content).run();
  return headings.length;
}

/** The next caption number, counting the captions already in the document. */
export function nextCaptionNumber(doc: JSONContent, label: string): number {
  const pattern = new RegExp(`^${label}\\s+(\\d+)`, 'i');
  let highest = 0;

  const walk = (node: JSONContent): void => {
    if (node.type === 'paragraph') {
      const match = pattern.exec(textOf(node).trim());
      if (match) highest = Math.max(highest, Number(match[1]));
    }
    for (const child of node.content ?? []) walk(child);
  };

  walk(doc);
  return highest + 1;
}

export function insertCaption(editor: Editor, label = 'Figure'): number {
  const number = nextCaptionNumber(editor.getJSON(), label);

  editor
    .chain()
    .focus()
    .insertContent({
      type: 'paragraph',
      content: [{ type: 'text', text: `${label} ${number}: `, marks: [{ type: 'bold' }] }],
    })
    .run();

  return number;
}

/**
 * Whether a picture's alternative text actually describes it.
 *
 * Every way of inserting a picture here fills `alt` in — a shape takes its own
 * name, a chosen file takes its file name — so a check for *empty* alt text
 * could never fire. `IMG_2451.JPG` is not a description, and that is the case
 * worth catching: a file name read aloud tells a screen-reader user nothing.
 */
export function isFileName(alt: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|tiff?|heic)$/i.test(alt.trim());
}

export type AccessibilityIssue =
  | { kind: 'image-without-description'; count: number }
  | { kind: 'no-headings' }
  | { kind: 'skipped-heading-level'; from: number; to: number };

/**
 * What Word's accessibility checker would flag, cut to what this build can
 * actually see: pictures with no alternative text, a document with no headings
 * to navigate by, and a heading level skipped on the way down.
 */
export function accessibilityIssues(doc: JSONContent): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  let undescribed = 0;

  const walk = (node: JSONContent): void => {
    if (node.type === 'image') {
      const alt = String(node.attrs?.alt ?? '');
      if (alt.trim().length === 0 || isFileName(alt)) undescribed += 1;
    }
    for (const child of node.content ?? []) walk(child);
  };
  walk(doc);

  if (undescribed > 0) issues.push({ kind: 'image-without-description', count: undescribed });

  const headings = headingsOf(doc);
  if (headings.length === 0) {
    issues.push({ kind: 'no-headings' });
    return issues;
  }

  for (let i = 1; i < headings.length; i += 1) {
    const previous = headings[i - 1]!.level;
    const current = headings[i]!.level;
    if (current > previous + 1) issues.push({ kind: 'skipped-heading-level', from: previous, to: current });
  }

  return issues;
}

export function describeAccessibility(issues: AccessibilityIssue[]): string {
  if (issues.length === 0) return 'No accessibility problems found.';

  return issues
    .map((issue) => {
      if (issue.kind === 'image-without-description') {
        return `${issue.count} picture${issue.count === 1 ? '' : 's'} without a description.`;
      }
      if (issue.kind === 'no-headings') return 'No headings, so the document cannot be navigated by structure.';
      return `Heading level ${issue.from} is followed by level ${issue.to}.`;
    })
    .join(' ');
}

/**
 * The document as one string, for Read Aloud.
 *
 * Paragraph breaks become full stops so the speech engine pauses between
 * blocks instead of running a heading into the sentence beneath it.
 */
export function readableText(doc: JSONContent): string {
  const blocks: string[] = [];

  const walk = (node: JSONContent): void => {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const text = textOf(node).trim();
      if (text.length > 0) blocks.push(/[.!?]$/.test(text) ? text : `${text}.`);
      return;
    }
    for (const child of node.content ?? []) walk(child);
  };

  walk(doc);
  return blocks.join(' ');
}
