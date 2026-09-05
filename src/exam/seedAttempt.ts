import type { JSONContent } from '@tiptap/core';
import type { ExamAttempt, ExamQuestion, Localised } from './types';

/**
 * The demo paper: Word-operation tasks, in Hindi and English.
 *
 * Each question gives a passage and asks for one operation on it. The passage
 * is the whole answer document — the instruction lives outside the editor — so
 * everything in the document is under test.
 *
 * A fixture, not a fallback: `useExamStore.setAttempt` replaces it wholesale
 * once questions come from a real source. The answer key lives separately, and
 * server-side, in `src/server/marking/questionBank.ts`.
 */

/** Builds a passage from one paragraph per line. */
function passage(...lines: string[]): JSONContent {
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line === '' ? [] : [{ type: 'text', text: line }],
    })),
  };
}

/** A three-column table: S. No., the given words, and an empty column to fill. */
function wordTable(headers: [string, string, string], words: string[]): JSONContent {
  const cell = (text: string, header = false): JSONContent => ({
    type: header ? 'tableHeader' : 'tableCell',
    content: [{ type: 'paragraph', content: text === '' ? [] : [{ type: 'text', text }] }],
  });

  return {
    type: 'doc',
    content: [
      {
        type: 'table',
        content: [
          { type: 'tableRow', content: headers.map((text) => cell(text, true)) },
          ...words.map((word) => ({
            type: 'tableRow',
            content: [cell(''), cell(word), cell('')],
          })),
        ],
      },
    ],
  };
}

/** A pre-formatted passage, so there is something for "remove formatting" to do. */
function formattedPassage(text: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text,
            marks: [
              { type: 'bold' },
              { type: 'italic' },
              { type: 'underline' },
              { type: 'textStyle', attrs: { color: '#0070c0', fontSize: '16pt' } },
            ],
          },
        ],
      },
    ],
  };
}

interface Draft {
  instruction: Localised<string>;
  passage: Localised<JSONContent>;
  marks: number;
}

const EN = 'The quick brown fox jumps over the lazy dog near the river bank.';
const HI = 'सूचना प्रौद्योगिकी ने हमारे कार्य करने के तरीके को पूरी तरह बदल दिया है।';

/** Same passage in both languages, for the many "format the paragraph" tasks. */
const both = (en: string, hi: string): Localised<JSONContent> => ({
  en: passage(en),
  hi: passage(hi),
});

const DRAFTS: Draft[] = [
  {
    instruction: {
      hi: 'पैराग्राफ को बोल्ड करें और अंडरलाइन करें।',
      en: 'Make the paragraph bold and underline it.',
    },
    passage: both(EN, HI),
    marks: 3,
  },
  {
    instruction: {
      hi: 'पैराग्राफ को स्ट्राइकथ्रू करें।',
      en: 'Apply strikethrough to the paragraph.',
    },
    passage: both(EN, HI),
    marks: 3,
  },
  {
    instruction: {
      hi: 'टेबल में दिए गए शब्दों को कॉलम 2 में वैसे ही लिखें जैसे कॉलम 1 में दिए गए हैं।',
      en: 'Write the words given in the table into column 2, just as they are given in column 1.',
    },
    passage: {
      en: wordTable(['S. No.', 'Column 1', 'Column 2'], ['Keyboard', 'Monitor', 'Printer']),
      hi: wordTable(['क्र. सं.', 'कॉलम 1', 'कॉलम 2'], ['कीबोर्ड', 'मॉनिटर', 'प्रिंटर']),
    },
    marks: 4,
  },
  {
    instruction: {
      hi: 'पैराग्राफ को अपरकेस में बदलें।',
      en: 'Change the paragraph to uppercase.',
    },
    // Devanagari has no letter case, so this task uses an English passage in
    // both languages; only the instruction is translated.
    passage: { en: passage(EN), hi: passage(EN) },
    marks: 3,
  },
  {
    instruction: {
      hi: 'पैराग्राफ को हरे रंग से हाइलाइट करें।',
      en: 'Highlight the paragraph with green colour.',
    },
    passage: both(EN, HI),
    marks: 3,
  },
  {
    instruction: {
      hi: 'पैराग्राफ का फॉन्ट रंग लाल करें।',
      en: 'Change the font colour of the paragraph to red.',
    },
    passage: both(EN, HI),
    marks: 3,
  },
  {
    instruction: {
      hi: 'पैराग्राफ को एंग्रेव इफेक्ट प्रदान करें और उसे बाईं ओर संरेखित करें।',
      en: 'Apply the engrave effect to the paragraph and left-align it.',
    },
    passage: both(EN, HI),
    marks: 4,
  },
  {
    instruction: {
      hi: 'पैराग्राफ की फॉर्मेटिंग को रिमूव करें।',
      en: 'Remove the formatting of the paragraph.',
    },
    passage: { en: formattedPassage(EN), hi: formattedPassage(HI) },
    marks: 3,
  },
  {
    instruction: {
      hi: 'पैराग्राफ को एम्बॉस इफेक्ट प्रदान करें और उसे बाईं ओर संरेखित करें।',
      en: 'Apply the emboss effect to the paragraph and left-align it.',
    },
    passage: both(EN, HI),
    marks: 4,
  },
  {
    instruction: {
      hi: 'पैराग्राफ का फॉन्ट टाइम्स न्यू रोमन में सेट करें।',
      en: 'Set the font of the paragraph to Times New Roman.',
    },
    passage: both(EN, HI),
    marks: 3,
  },
  {
    instruction: {
      hi: 'पैराग्राफ का फॉन्ट साइज 20 में सेट करें।',
      en: 'Set the font size of the paragraph to 20.',
    },
    passage: both(EN, HI),
    marks: 3,
  },
  {
    instruction: {
      hi: 'पैराग्राफ की कैरेक्टर स्पेसिंग स्केल 200 प्रतिशत करें।',
      en: 'Set the character spacing scale of the paragraph to 200 percent.',
    },
    passage: both(EN, HI),
    marks: 3,
  },
  {
    instruction: {
      hi: 'पैराग्राफ की कैरेक्टर स्पेसिंग एक्सपैंड में 5 पॉइंट सेट करें।',
      en: 'Set the character spacing of the paragraph to Expanded by 5 points.',
    },
    passage: both(EN, HI),
    marks: 3,
  },
  {
    instruction: {
      hi: 'पैराग्राफ की कैरेक्टर स्पेसिंग कन्डेन्स्ड में 5 पॉइंट सेट करें और उसे बाईं ओर संरेखित करें।',
      en: 'Set the character spacing of the paragraph to Condensed by 5 points and left-align it.',
    },
    passage: both(EN, HI),
    marks: 4,
  },
  {
    instruction: {
      hi: 'टेबल के क्र. सं. कॉलम में ऑटो नंबर अप्लाई करें।',
      en: 'Apply auto numbering in the S. No. column of the table.',
    },
    passage: {
      en: wordTable(['S. No.', 'Device', 'Type'], ['Keyboard', 'Monitor', 'Printer']),
      hi: wordTable(['क्र. सं.', 'उपकरण', 'प्रकार'], ['कीबोर्ड', 'मॉनिटर', 'प्रिंटर']),
    },
    marks: 4,
  },
];

function buildQuestions(): ExamQuestion[] {
  return DRAFTS.map((draft, index) => ({
    number: index + 1,
    instruction: draft.instruction,
    passage: draft.passage,
    marks: draft.marks,
    // Every question starts untouched: nothing is flagged for review until the
    // candidate flags it.
    bookmarked: false,
  }));
}

export const SEED_ATTEMPT: ExamAttempt = {
  candidateName: 'Praveen',
  durationSeconds: 10 * 60,
  sections: [{ name: 'Word Processing', questions: buildQuestions() }],
};
