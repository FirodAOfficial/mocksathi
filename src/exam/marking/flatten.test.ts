import { describe, expect, it } from 'vitest';
import type { DocumentMetadata } from '@/services/document/types';
import { proseMirrorToDocument } from '@/editor/proseMirrorToDocument';
import { canonicalMarks, flatten, hasMark, marksEqual, normaliseText } from './flatten';

const META: DocumentMetadata = { title: '', format: 'blank', sourceUrl: null, unsupportedFeatures: [] };

const project = (doc: object) => flatten(proseMirrorToDocument(doc as never, META));

const text = (value: string, marks?: unknown[]) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const para = (...content: unknown[]) => ({ type: 'paragraph', content });
const doc = (...content: unknown[]) => ({ type: 'doc', content });

/**
 * The projection exists to make representation differences invisible, so these
 * pin the specific ways ProseMirror can express the same visible result.
 */
describe('flatten — canonicalisation', () => {
  it('gives the same projection whether a run is one text node or several', () => {
    const single = project(doc(para(text('quick brown', [{ type: 'bold' }]))));
    const split = project(
      doc(para(text('quick', [{ type: 'bold' }]), text(' brown', [{ type: 'bold' }]))),
    );

    expect(single.text).toBe(split.text);
    expect(single.chars.map((c) => c.marks)).toEqual(split.chars.map((c) => c.marks));
  });

  it('ignores the order marks were stored in', () => {
    const a = project(doc(para(text('hi', [{ type: 'bold' }, { type: 'italic' }]))));
    const b = project(doc(para(text('hi', [{ type: 'italic' }, { type: 'bold' }]))));

    expect(marksEqual(a.chars[0]!.marks, b.chars[0]!.marks)).toBe(true);
  });

  it('treats a textStyle mark holding only nulls as no formatting at all', () => {
    const styled = project(
      doc(para(text('hi', [{ type: 'textStyle', attrs: { fontSize: null, color: null, fontFamily: null } }]))),
    );

    expect(styled.chars[0]!.marks).toEqual({});
  });

  it('treats an explicit false the same as an absent mark', () => {
    expect(canonicalMarks({ bold: false, italic: true })).toEqual({ italic: true });
  });

  it('matches colours case-insensitively', () => {
    expect(hasMark(canonicalMarks({ highlight: '#FFFF00' }), 'highlight', '#ffff00')).toBe(true);
    expect(hasMark(canonicalMarks({ color: '#C00000' }), 'color', '#c00000')).toBe(true);
  });

  it('records where a trailing space sits relative to a mark', () => {
    // Both are legitimate; the projection reports them faithfully so that the
    // "nothing else changed" check can decide how forgiving to be.
    const inside = project(doc(para(text('bold ', [{ type: 'bold' }]), text('rest'))));
    const outside = project(doc(para(text('bold', [{ type: 'bold' }]), text(' rest'))));

    expect(inside.chars[4]!.marks.bold).toBe(true);
    expect(outside.chars[4]!.marks.bold).toBeUndefined();
  });
});

describe('flatten — structure', () => {
  it('indexes every character to its block and offset', () => {
    const projected = project(doc(para(text('ab')), para(text('cd'))));

    expect(projected.chars.map((c) => [c.char, c.block, c.offset])).toEqual([
      ['a', 0, 0],
      ['b', 0, 1],
      ['c', 1, 0],
      ['d', 1, 1],
    ]);
    expect(projected.text).toBe('ab\ncd');
  });

  it('gives each block a range into the character array', () => {
    const projected = project(doc(para(text('abc')), para(text('de'))));

    expect(projected.blocks[0]).toMatchObject({ start: 0, end: 3, text: 'abc' });
    expect(projected.blocks[1]).toMatchObject({ start: 3, end: 5, text: 'de' });
  });

  it('carries paragraph attributes and list membership', () => {
    const projected = project({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [text('x')] }] }],
        },
      ],
    });

    expect(projected.blocks[0]?.list).toEqual({ kind: 'bullet', level: 0 });
    expect(projected.blocks[0]?.paragraph.align).toBe('center');
  });

  it('reads a hard break as a newline inside the block', () => {
    const projected = project(doc(para(text('a'), { type: 'hardBreak' }, text('b'))));

    expect(projected.blocks[0]?.text).toBe('a\nb');
  });

  it('handles an empty document without throwing', () => {
    expect(project(doc(para()))).toMatchObject({ chars: [], text: '' });
  });
});

describe('normaliseText', () => {
  it('collapses whitespace, trims, and treats a non-breaking space as a space', () => {
    expect(normaliseText('  the   quick brown  ')).toBe('the quick brown');
  });

  it('normalises decomposed accents so typing method does not matter', () => {
    expect(normaliseText('café')).toBe(normaliseText('café'));
  });
});
