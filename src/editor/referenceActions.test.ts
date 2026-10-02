import { describe, expect, it } from 'vitest';
import {
  accessibilityIssues,
  buildTableOfContents,
  describeAccessibility,
  headingsOf,
  nextCaptionNumber,
  readableText,
} from './referenceActions';

const text = (value: string) => ({ type: 'text', text: value });
const para = (value: string) => ({ type: 'paragraph', content: [text(value)] });
const heading = (level: number, value: string) => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});
const doc = (...content: unknown[]) => ({ type: 'doc', content }) as never;

describe('headingsOf', () => {
  it('reads every heading in order, with its level', () => {
    expect(headingsOf(doc(heading(1, 'One'), para('body'), heading(2, 'Two')))).toEqual([
      { level: 1, text: 'One' },
      { level: 2, text: 'Two' },
    ]);
  });

  /* An empty heading is a blank line a candidate left behind, not a section. */
  it('ignores an empty heading', () => {
    expect(headingsOf(doc({ type: 'heading', attrs: { level: 1 } }))).toEqual([]);
  });
});

describe('buildTableOfContents', () => {
  it('is nothing at all when there are no headings', () => {
    expect(buildTableOfContents([])).toEqual([]);
  });

  it('indents by level, so the list reads as a hierarchy', () => {
    const [, first, second] = buildTableOfContents([
      { level: 1, text: 'One' },
      { level: 2, text: 'Two' },
    ]);

    expect(first?.attrs?.indentLeft).toBeNull();
    expect(second?.attrs?.indentLeft).toBe(24);
  });
});

describe('nextCaptionNumber', () => {
  it('starts at one', () => {
    expect(nextCaptionNumber(doc(para('body')), 'Figure')).toBe(1);
  });

  it('continues from the highest caption already there', () => {
    expect(nextCaptionNumber(doc(para('Figure 1: a'), para('Figure 4: b')), 'Figure')).toBe(5);
  });

  it('counts its own label only', () => {
    expect(nextCaptionNumber(doc(para('Table 7: a')), 'Figure')).toBe(1);
  });
});

describe('accessibilityIssues', () => {
  it('finds a picture with no description', () => {
    const issues = accessibilityIssues(doc(heading(1, 'One'), { type: 'image', attrs: { src: 'x', alt: '' } }));
    expect(issues).toContainEqual({ kind: 'image-without-description', count: 1 });
  });

  it('accepts a picture that has one', () => {
    const issues = accessibilityIssues(doc(heading(1, 'One'), { type: 'image', attrs: { src: 'x', alt: 'A chart' } }));
    expect(issues).toEqual([]);
  });

  /*
   * The case that actually happens: every insert path fills `alt` in, so a
   * check for empty alt text alone would never fire. A file name is what a
   * chosen picture arrives with, and it describes nothing.
   */
  it('flags a picture whose description is just its file name', () => {
    const issues = accessibilityIssues(
      doc(heading(1, 'One'), { type: 'image', attrs: { src: 'x', alt: 'IMG_2451.JPG' } }),
    );
    expect(issues).toContainEqual({ kind: 'image-without-description', count: 1 });
  });

  it('accepts a description that merely mentions a picture', () => {
    const issues = accessibilityIssues(
      doc(heading(1, 'One'), { type: 'image', attrs: { src: 'x', alt: 'A photograph of the office' } }),
    );
    expect(issues).toEqual([]);
  });

  it('says so when there is nothing to navigate by', () => {
    expect(accessibilityIssues(doc(para('body')))).toEqual([{ kind: 'no-headings' }]);
  });

  it('flags a level skipped on the way down', () => {
    expect(accessibilityIssues(doc(heading(1, 'One'), heading(3, 'Three')))).toContainEqual({
      kind: 'skipped-heading-level',
      from: 1,
      to: 3,
    });
  });

  /* Coming back up is how sections end; only going down skips a level. */
  it('does not flag a return to a higher level', () => {
    expect(accessibilityIssues(doc(heading(1, 'A'), heading(2, 'B'), heading(1, 'C')))).toEqual([]);
  });

  it('reports a clean document as clean', () => {
    expect(describeAccessibility([])).toBe('No accessibility problems found.');
  });
});

describe('readableText', () => {
  it('ends each block so the speech engine pauses between them', () => {
    expect(readableText(doc(heading(1, 'Title'), para('Body text')))).toBe('Title. Body text.');
  });

  it('does not add a second full stop', () => {
    expect(readableText(doc(para('Already done.')))).toBe('Already done.');
  });
});
