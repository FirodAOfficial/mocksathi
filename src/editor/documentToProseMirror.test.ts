import { describe, expect, it } from 'vitest';
import type { DocumentModel, ParagraphBlock } from '@/services/document/types';
import { createBlankDocument, createParagraph } from '@/services/document/types';
import { documentToProseMirror } from './documentToProseMirror';
import { proseMirrorToDocument } from './proseMirrorToDocument';

const doc = (body: ParagraphBlock[]): DocumentModel => ({
  metadata: { title: 'Test', format: 'docx', sourceUrl: null, unsupportedFeatures: [] },
  body,
});

const text = (value: string, marks: ParagraphBlock['runs'][number]['marks'] = {}) => ({ text: value, marks });

describe('documentToProseMirror', () => {
  it('never produces an empty document, which ProseMirror rejects', () => {
    expect(documentToProseMirror(doc([])).content).toHaveLength(1);
  });

  it('emits headings as heading nodes and quotes as blockquotes', () => {
    const output = documentToProseMirror(
      doc([
        createParagraph({ styleId: 'Heading2', headingLevel: 2, runs: [text('Section')] }),
        createParagraph({ styleId: 'Quote', runs: [text('Quoted')] }),
      ]),
    );

    expect(output.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
    expect(output.content?.[1]).toMatchObject({ type: 'blockquote' });
  });

  it('carries Title and Subtitle as named paragraph styles', () => {
    const output = documentToProseMirror(doc([createParagraph({ styleId: 'Title', runs: [text('T')] })]));

    expect(output.content?.[0]).toMatchObject({ type: 'paragraph', attrs: { styleName: 'Title' } });
  });

  it('gathers font, size and colour into one textStyle mark', () => {
    const output = documentToProseMirror(
      doc([
        createParagraph({
          runs: [text('Styled', { bold: true, fontFamily: 'Arial', fontSize: 14, color: '#ff0000' })],
        }),
      ]),
    );

    const marks = (output.content?.[0]?.content?.[0]?.marks ?? []) as { type: string; attrs?: unknown }[];
    expect(marks.map((mark) => mark.type).sort()).toEqual(['bold', 'textStyle']);
    expect(marks.find((mark) => mark.type === 'textStyle')?.attrs).toEqual({
      fontFamily: 'Arial',
      fontSize: '14pt',
      color: '#ff0000',
    });
  });

  it('rebuilds nested lists from flat paragraphs', () => {
    const output = documentToProseMirror(
      doc([
        createParagraph({ list: { kind: 'bullet', level: 0 }, runs: [text('One')] }),
        createParagraph({ list: { kind: 'bullet', level: 1 }, runs: [text('One A')] }),
        createParagraph({ list: { kind: 'bullet', level: 0 }, runs: [text('Two')] }),
      ]),
    );

    expect(output.content).toHaveLength(1);
    const list = output.content?.[0];
    expect(list?.type).toBe('bulletList');
    expect(list?.content).toHaveLength(2);
    // The nested list is attached to the item it belongs under, not to the root.
    expect(list?.content?.[0]?.content?.[1]).toMatchObject({ type: 'bulletList' });
  });

  it('starts a new list when the marker kind changes at the same level', () => {
    const output = documentToProseMirror(
      doc([
        createParagraph({ list: { kind: 'bullet', level: 0 }, runs: [text('Bullet')] }),
        createParagraph({ list: { kind: 'ordered', level: 0 }, runs: [text('Number')] }),
      ]),
    );

    expect(output.content?.map((node) => node.type)).toEqual(['bulletList', 'orderedList']);
  });

  it('closes open lists when an ordinary paragraph follows', () => {
    const output = documentToProseMirror(
      doc([
        createParagraph({ list: { kind: 'bullet', level: 0 }, runs: [text('Item')] }),
        createParagraph({ runs: [text('After')] }),
      ]),
    );

    expect(output.content?.map((node) => node.type)).toEqual(['bulletList', 'paragraph']);
  });

  it('turns line breaks into hardBreak nodes and drops empty runs', () => {
    const output = documentToProseMirror(
      doc([
        createParagraph({
          runs: [text('One'), { text: '', marks: {}, lineBreak: true }, text('Two'), text('')],
        }),
      ]),
    );

    expect(output.content?.[0]?.content?.map((node) => node.type)).toEqual(['text', 'hardBreak', 'text']);
  });
});

describe('round trip through ProseMirror and back', () => {
  it('preserves block structure, formatting and lists', () => {
    const original = doc([
      createParagraph({ styleId: 'Heading1', headingLevel: 1, runs: [text('Report')] }),
      createParagraph({
        runs: [text('Bold', { bold: true }), text(' and '), text('coloured', { color: '#ff0000', fontSize: 14 })],
        paragraph: {
          align: 'center',
          indentLeft: 48,
          indentRight: null,
          indentFirstLine: null,
          lineHeight: 1.5,
          spaceBefore: null,
          spaceAfter: 12,
          borders: null,
        },
      }),
      createParagraph({ list: { kind: 'ordered', level: 0 }, runs: [text('First')] }),
      createParagraph({ styleId: 'Quote', runs: [text('Quoted')] }),
    ]);

    const restored = proseMirrorToDocument(documentToProseMirror(original), original.metadata);

    expect(restored.body.map((block) => block.styleId)).toEqual(['Heading1', 'Normal', 'Normal', 'Quote']);
    expect(restored.body[1]?.paragraph).toMatchObject({ align: 'center', indentLeft: 48, lineHeight: 1.5, spaceAfter: 12 });
    expect(restored.body[1]?.runs.map((textRun) => textRun.marks)).toEqual([
      { bold: true },
      {},
      { color: '#ff0000', fontSize: 14 },
    ]);
    expect(restored.body[2]?.list).toEqual({ kind: 'ordered', level: 0 });
  });

  it('round-trips a blank document to a single empty paragraph', () => {
    const blank = createBlankDocument();
    const restored = proseMirrorToDocument(documentToProseMirror(blank), blank.metadata);

    expect(restored.body).toHaveLength(1);
    expect(restored.body[0]?.runs).toEqual([]);
  });
});
