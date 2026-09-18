import { describe, expect, it } from 'vitest';
import { proseMirrorToDocument } from '@/editor/proseMirrorToDocument';
import { flatten } from '@/exam/marking/flatten';
import type { JSONContent } from '@tiptap/core';
import { questionPreview } from './questionPreview';

/**
 * What the author is shown while writing a question.
 *
 * The preview is only worth having if it is the truth, so these assert the
 * documents themselves rather than that something rendered: the starting
 * passage carries the formatting the question starts with, the answer carries
 * what the question asks for, and — the case the whole `initial` mechanism
 * exists for — a question can hand the candidate formatting and ask for it to
 * be taken off again.
 */

const LINES = ['The first paragraph of the notice.', 'The second paragraph of the notice.'];

/** The formatting of every character of one paragraph, as the marker sees it. */
function marksOf(document: JSONContent, block: number) {
  const projected = flatten(
    proseMirrorToDocument(document, { title: 'preview', format: 'blank', sourceUrl: null, unsupportedFeatures: [] }),
  );
  const paragraph = projected.blocks[block]!;
  return projected.chars.slice(paragraph.start, paragraph.end).map((char) => char.marks);
}

describe('questionPreview', () => {
  it('shows a plain passage and a formatted answer for an ordinary question', () => {
    const preview = questionPreview({
      lines: LINES,
      scope: { select: 'paragraph', index: 2 },
      operations: [{ kind: 'bold' }],
      initial: [],
    })!;

    expect(preview).not.toBeNull();
    expect(marksOf(preview.start, 1).every((marks) => marks.bold === undefined)).toBe(true);
    expect(marksOf(preview.answer, 1).every((marks) => marks.bold === true)).toBe(true);
    // The paragraph the question does not name is untouched in both.
    expect(marksOf(preview.answer, 0).every((marks) => marks.bold === undefined)).toBe(true);
  });

  it('hands the candidate formatting and lets the question ask for it back', () => {
    // The shape of "remove the highlight from the second paragraph": the
    // passage arrives highlighted, and the worked answer is the passage without
    // it. Without the starting formatting, doing nothing would be correct.
    const preview = questionPreview({
      lines: LINES,
      scope: { select: 'paragraph', index: 2 },
      operations: [{ kind: 'removeHighlight' }],
      initial: [{ kind: 'highlight', color: '#ffff00' }],
    })!;

    expect(marksOf(preview.start, 1).every((marks) => marks.highlight === '#ffff00')).toBe(true);
    expect(marksOf(preview.answer, 1).every((marks) => marks.highlight === undefined)).toBe(true);
  });

  it('is the same operation either way round', () => {
    // And the reverse: the same function applied by the question instead of by
    // the passage. One vocabulary, pointed in the other direction.
    const preview = questionPreview({
      lines: LINES,
      scope: { select: 'paragraph', index: 1 },
      operations: [{ kind: 'highlight', color: '#ffff00' }],
      initial: [],
    })!;

    expect(marksOf(preview.start, 0).every((marks) => marks.highlight === undefined)).toBe(true);
    expect(marksOf(preview.answer, 0).every((marks) => marks.highlight === '#ffff00')).toBe(true);
  });

  it('formats exactly the words a named selection covers', () => {
    // The reason the preview exists: "the third word" and "the third paragraph"
    // are one index apart in the form and nothing else would show the
    // difference.
    const preview = questionPreview({
      lines: LINES,
      scope: { select: 'word', index: 3 },
      operations: [{ kind: 'bold' }],
      initial: [],
    })!;

    const bolded = marksOf(preview.answer, 0)
      .map((marks, index) => (marks.bold ? LINES[0]![index] : ''))
      .join('');
    expect(bolded).toBe('paragraph');
  });

  it('shows nothing rather than a guess when the question is not yet answerable', () => {
    expect(questionPreview({ lines: [''], scope: 'all', operations: [], initial: [] })).toBeNull();
    // A selection naming a word the passage does not have: the question could
    // not be marked, and the form says so instead of rendering a blank sheet.
    expect(
      questionPreview({
        lines: LINES,
        scope: { select: 'word', index: 99 },
        operations: [{ kind: 'bold' }],
        initial: [],
      })?.answer,
    ).toEqual(questionPreview({ lines: LINES, scope: 'all', operations: [], initial: [] })?.start);
  });
});
