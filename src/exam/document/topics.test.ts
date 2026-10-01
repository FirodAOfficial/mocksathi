import { describe, expect, it } from 'vitest';
import { parseDocumentQuestionFields } from '@/db/documentPaperInput';
import { CHARACTER_PROPERTIES, PARAGRAPH_ATTRIBUTES } from './detect';
import { DOCUMENT_TOPICS, joinTopics, splitTopics, topicsFor } from './topics';
import type { DocumentStep } from './types';

function characterStep(property: string, value: unknown = true): DocumentStep {
  return {
    level: 'character',
    block: 0,
    from: 0,
    to: 4,
    text: 'Word',
    changes: [{ property, value, previous: null, range: { from: 0, to: 4 }, licence: { from: 0, to: 4 } } as never],
  };
}

function paragraphStep(property: string, value: unknown = 'x'): DocumentStep {
  return { level: 'paragraph', blocks: [0], changes: [{ property, value, previous: null } as never] };
}

describe('topics', () => {
  it('has a topic for every property detection can read', () => {
    for (const property of CHARACTER_PROPERTIES) expect(topicsFor([characterStep(property)])).toHaveLength(1);
    for (const property of [...PARAGRAPH_ATTRIBUTES, 'styleId', 'list']) {
      expect(topicsFor([paragraphStep(property)])).toHaveLength(1);
    }
  });

  it.each([
    ['bold', 'Font Style'],
    ['vertAlign', 'Font Style'],
    ['fontSize', 'Font & Size'],
    ['highlight', 'Font Colour & Highlight'],
    ['caps', 'Font Effects'],
  ])('selects %s as %s', (property, topic) => {
    expect(topicsFor([characterStep(property)])).toEqual([topic]);
  });

  it.each([
    ['align', 'Alignment'],
    ['lineHeight', 'Line & Paragraph Spacing'],
    ['indentFirstLine', 'Indentation'],
    ['borders', 'Borders'],
    ['styleId', 'Styles'],
    ['list', 'Bullets & Numbering'],
  ])('selects %s as %s', (property, topic) => {
    expect(topicsFor([paragraphStep(property)])).toEqual([topic]);
  });

  it('selects several, once each, in list order', () => {
    expect(
      topicsFor([paragraphStep('align'), characterStep('fontSize'), characterStep('bold'), characterStep('italic')]),
    ).toEqual(['Font Style', 'Font & Size', 'Alignment']);
  });

  it('ignores changes nobody can see', () => {
    expect(topicsFor([{ ...characterStep('bold'), licenceOnly: true }])).toEqual([]);
  });

  it('round-trips through the topic column', () => {
    const topics = ['Alignment', 'Font Style'] as const;
    expect(splitTopics(joinTopics([...topics]))).toEqual(['Font Style', 'Alignment']);
    expect(splitTopics('Character Formatting')).toEqual([]);
  });

  it('has no topic name containing the separator', () => {
    for (const topic of DOCUMENT_TOPICS) expect(topic).not.toContain(',');
  });
});

describe('the server accepts topics only from the list', () => {
  const base = { instructionEn: 'Bold the word.', marks: '1', difficulty: 'Easy' };

  it('stores chosen topics in list order', () => {
    const parsed = parseDocumentQuestionFields({ ...base, topics: ['Alignment', 'Font Style'] });
    expect(parsed.ok && parsed.fields.topic).toBe('Font Style, Alignment');
  });

  it('requires at least one', () => {
    const parsed = parseDocumentQuestionFields({ ...base, topics: [] });
    expect(!parsed.ok && parsed.code).toBe('TOPIC_REQUIRED');
  });

  it('refuses one that is not on the list', () => {
    const parsed = parseDocumentQuestionFields({ ...base, topics: ['Font Style', 'Anything I like'] });
    expect(!parsed.ok && parsed.code).toBe('INVALID_TOPIC');
  });
});
