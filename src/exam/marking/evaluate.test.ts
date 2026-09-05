import { describe, expect, it } from 'vitest';
import { proseMirrorToDocument } from '@/editor/proseMirrorToDocument';
import type { DocumentMetadata } from '@/services/document/types';
import type { Criterion } from './criteria';
import { evaluateCriterion, resolveTarget } from './evaluate';
import { flatten } from './flatten';

const META: DocumentMetadata = { title: '', format: 'blank', sourceUrl: null, unsupportedFeatures: [] };
const project = (doc: object) => flatten(proseMirrorToDocument(doc as never, META));

const text = (value: string, marks?: unknown[]) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const para = (content: unknown[], attrs?: Record<string, unknown>) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content });
const doc = (...content: unknown[]) => ({ type: 'doc', content });

const SENTENCE = 'The quick brown fox jumps over the lazy dog.';
const start = project(doc(para([text(SENTENCE)])));

/** The same sentence with `phrase` carrying `marks`. */
function withMarked(phrase: string, marks: unknown[]) {
  const at = SENTENCE.indexOf(phrase);
  return project(
    doc(
      para([
        text(SENTENCE.slice(0, at)),
        text(phrase, marks),
        text(SENTENCE.slice(at + phrase.length)),
      ]),
    ),
  );
}

const run = (criterion: Criterion, submitted = start) => evaluateCriterion(criterion, submitted, start);

describe('resolveTarget', () => {
  it('finds text within a block', () => {
    expect(resolveTarget({ by: 'text', text: 'quick' }, start)).toEqual([4, 5, 6, 7, 8]);
  });

  it('picks a later occurrence when asked', () => {
    const repeated = project(doc(para([text('ab ab ab')])));
    expect(resolveTarget({ by: 'text', text: 'ab', occurrence: 2 }, repeated)).toEqual([3, 4]);
  });

  it('reports text that is not there', () => {
    expect(resolveTarget({ by: 'text', text: 'penguin' }, start)).toBeNull();
  });

  it('never matches across a paragraph boundary', () => {
    const two = project(doc(para([text('foo')]), para([text('bar')])));
    expect(resolveTarget({ by: 'text', text: 'foobar' }, two)).toBeNull();
  });

  it('resolves ranges relative to their block', () => {
    const two = project(doc(para([text('abc')]), para([text('defg')])));
    expect(resolveTarget({ by: 'range', block: 1, from: 1, to: 3 }, two)).toEqual([4, 5]);
  });

  it('rejects a range that runs past the end of its block', () => {
    expect(resolveTarget({ by: 'range', block: 0, from: 0, to: 999 }, start)).toBeNull();
  });
});

describe('marked / notMarked', () => {
  const bold: Criterion = { kind: 'marked', label: 'Bold', target: { by: 'text', text: 'quick brown' }, mark: 'bold' };

  it('passes when the whole span carries the mark', () => {
    expect(run(bold, withMarked('quick brown', [{ type: 'bold' }])).passed).toBe(true);
  });

  it('fails, and says so, when only part of the span is marked', () => {
    const result = run(bold, withMarked('quick', [{ type: 'bold' }]));

    expect(result.passed).toBe(false);
    expect(result.detail).toContain('only part');
  });

  it('fails when nothing was done', () => {
    expect(run(bold).passed).toBe(false);
  });

  it('fails when the target text cannot be found', () => {
    const result = run({ ...bold, target: { by: 'text', text: 'missing' } });

    expect(result.passed).toBe(false);
    expect(result.detail).toContain('Could not find');
  });

  it('checks the value for marks that carry one', () => {
    const yellow = withMarked('quick', [{ type: 'highlight', attrs: { color: '#ffff00' } }]);
    const green = withMarked('quick', [{ type: 'highlight', attrs: { color: '#00ff00' } }]);
    const criterion: Criterion = {
      kind: 'marked',
      label: 'Yellow',
      target: { by: 'text', text: 'quick' },
      mark: 'highlight',
      value: '#ffff00',
    };

    expect(run(criterion, yellow).passed).toBe(true);
    expect(run(criterion, green).passed).toBe(false);
  });

  it('notMarked catches formatting that should not be there', () => {
    const criterion: Criterion = { kind: 'notMarked', label: 'Rest plain', target: { by: 'text', text: 'lazy dog.' }, mark: 'bold' };

    expect(run(criterion, withMarked('quick brown', [{ type: 'bold' }])).passed).toBe(true);
    expect(run(criterion, withMarked('lazy dog.', [{ type: 'bold' }])).passed).toBe(false);
  });
});

describe('block-level criteria', () => {
  it('checks a paragraph attribute', () => {
    const centred = project(doc(para([text('x')], { textAlign: 'center' })));
    const criterion: Criterion = { kind: 'blockAttr', label: 'Centred', block: 0, attr: 'align', value: 'center' };

    expect(evaluateCriterion(criterion, centred, centred).passed).toBe(true);
    expect(run(criterion).passed).toBe(false);
  });

  it('checks a gallery style', () => {
    const heading = project(doc({ type: 'heading', attrs: { level: 1 }, content: [text('Title')] }));
    const criterion: Criterion = { kind: 'blockStyle', label: 'H1', block: 0, styleId: 'Heading1' };

    expect(evaluateCriterion(criterion, heading, heading).passed).toBe(true);
    expect(run(criterion).passed).toBe(false);
  });

  it('checks list membership across every block', () => {
    const list = project({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: ['a', 'b'].map((value) => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: [text(value)] }],
          })),
        },
      ],
    });
    const criterion: Criterion = { kind: 'listKind', label: 'Bulleted', block: 'all', listKind: 'bullet' };

    expect(evaluateCriterion(criterion, list, list).passed).toBe(true);
    expect(run(criterion).passed).toBe(false);
  });
});

describe('text expectations', () => {
  const replaced = project(doc(para([text('The color of the door.')])));

  it('compares wording after normalising whitespace', () => {
    const spaced = project(doc(para([text('  The   color of the door.  ')])));
    const criterion: Criterion = { kind: 'text', label: 'Wording', expect: { equals: 'The color of the door.' } };

    expect(evaluateCriterion(criterion, spaced, replaced).passed).toBe(true);
  });

  it('catches text that should have been removed', () => {
    const criterion: Criterion = { kind: 'text', label: 'No colour', expect: { notContains: 'colour' } };
    const original = project(doc(para([text('The colour of the door.')])));

    expect(evaluateCriterion(criterion, replaced, replaced).passed).toBe(true);
    expect(evaluateCriterion(criterion, original, original).detail).toContain('still present');
  });

  it('counts occurrences', () => {
    const three = project(doc(para([text('color color color')])));
    const criterion: Criterion = { kind: 'text', label: 'Three', expect: { occurrences: { of: 'color', count: 3 } } };

    expect(evaluateCriterion(criterion, three, three).passed).toBe(true);
    expect(evaluateCriterion(criterion, replaced, replaced).detail).toContain('found 1');
  });
});

describe('unchanged — collateral damage', () => {
  const criterion: Criterion = {
    kind: 'unchanged',
    label: 'Rest untouched',
    except: [{ by: 'text', text: 'quick brown' }],
  };

  it('passes when only the target was formatted', () => {
    expect(run(criterion, withMarked('quick brown', [{ type: 'bold' }])).passed).toBe(true);
  });

  it('fails when something else was formatted too', () => {
    const result = run(criterion, withMarked('lazy dog.', [{ type: 'bold' }]));

    expect(result.passed).toBe(false);
    expect(result.detail).toContain('left alone');
  });

  it('fails when the wording was changed', () => {
    const edited = project(doc(para([text('The slow brown fox jumps over the lazy dog.')])));
    expect(run(criterion, edited).detail).toContain('wording');
  });

  it('forgives a space caught at the edge of the selection', () => {
    // Double-clicking a word in Word takes the trailing space with it; doing
    // that is not a wrong answer.
    expect(run(criterion, withMarked('quick brown ', [{ type: 'bold' }])).passed).toBe(true);
  });
});
