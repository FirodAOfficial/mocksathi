import type { Localised } from '@/exam/types';
import type { WordQuestionDraft } from '@/exam/authoring';

/**
 * Word Efficiency Tests 4 and 5.
 *
 * Two papers written from the question lists the tests are set from, in the
 * authoring vocabulary rather than by hand: each question states the text it is
 * about and the operations it asks for, and the worked answer and the answer
 * key are both derived from that (`src/exam/authoring/word.ts`,
 * `src/server/marking/rubricFromOperations.ts`).
 *
 * They live in the source, not only in the migration that loads them, for one
 * reason: `wordEfficiency.test.ts` marks every question in both papers — the
 * worked answer must score full marks and the untouched passage must score
 * none. A paper that only existed as SQL could not be checked that way, and a
 * question whose key does not match its own instruction is exactly the failure
 * this whole design exists to prevent.
 *
 * ## Two constraints these papers are written around
 *
 * **A paper is sat in one language, and marked by one key.** So a question that
 * names text by its words — "wherever 'MSP' appears" — has to name something
 * that reads the same in both passages. The papers use codes and terms that
 * a bilingual government notice carries verbatim (MSP, Strategy, Innovation),
 * which is also how those notices are actually written. A question naming an
 * ordinary word would need a Hindi key and an English one, and there is one.
 *
 * **Questions about tables, headers, page borders, watermarks, page numbers and
 * gutter margins are not here.** The document model has no cell shading, no
 * table structure operations, and no page settings at all, so those questions
 * could be typed in but never marked. They are replaced below by questions
 * exercising the same ribbon groups on paragraphs, and each replacement says
 * what it stands in for. Adding those families is described in
 * `.claude/skills/editor-functions/SKILL.md`.
 */

export interface WordPaper {
  name: string;
  slug: string;
  tagline: string;
  sectionName: string;
  durationMinutes: number;
  qualifyingMarks: number;
  questions: WordQuestionDraft[];
}

/* -- Passages -------------------------------------------------------------- */

/**
 * Paper 4's passage: a district notice.
 *
 * "MSP" appears twice and in both languages, which is what makes the
 * replacement question markable in either.
 */
const NOTICE: Localised<string[]> = {
  en: [
    'The district office will publish the revised MSP schedule for every registered applicant this month.',
    'Field officers must record the survey readings twice a day and file them with the zonal supervisor.',
    'Any applicant whose MSP claim has changed must inform the help desk in writing before the last date.',
    'The revised timetable will be displayed on the notice board outside the main gate of the office.',
    'Late submissions are accepted only with a written explanation from the reporting officer concerned.',
  ],
  hi: [
    'जिला कार्यालय इस माह प्रत्येक पंजीकृत आवेदक के लिए संशोधित MSP सूची प्रकाशित करेगा।',
    'क्षेत्रीय अधिकारी प्रतिदिन दो बार सर्वेक्षण रीडिंग दर्ज करेंगे और उन्हें पर्यवेक्षक को भेजेंगे।',
    'जिस आवेदक का MSP दावा बदला है, वह अंतिम तिथि से पहले सहायता केंद्र को लिखित सूचना दे।',
    'संशोधित समय-सारणी कार्यालय के मुख्य द्वार के बाहर सूचना पट पर प्रदर्शित की जाएगी।',
    'विलंब से प्राप्त आवेदन केवल संबंधित रिपोर्टिंग अधिकारी के लिखित स्पष्टीकरण के साथ स्वीकार होंगे।',
  ],
};

/** Paper 5's passage: a company circular, carrying "Strategy" and "Innovation". */
const CIRCULAR: Localised<string[]> = {
  en: [
    'The Strategy group will present the quarterly review to every department head on Friday afternoon.',
    'Innovation remains the first measure of progress in each of the four business units this year.',
    'Team leads should collect feedback from their members before the Strategy session begins.',
    'The Innovation award will be announced once the review of all submitted proposals is complete.',
    'Queries about the agenda may be sent to the office of the general manager until Thursday evening.',
  ],
  hi: [
    'Strategy समूह शुक्रवार अपराह्न प्रत्येक विभागाध्यक्ष के समक्ष तिमाही समीक्षा प्रस्तुत करेगा।',
    'इस वर्ष चारों व्यावसायिक इकाइयों में प्रगति का पहला मापदंड Innovation ही रहेगा।',
    'दल प्रमुख Strategy सत्र आरंभ होने से पूर्व अपने सदस्यों से सुझाव एकत्र करें।',
    'सभी प्राप्त प्रस्तावों की समीक्षा पूर्ण होने पर Innovation पुरस्कार की घोषणा की जाएगी।',
    'कार्यसूची से संबंधित प्रश्न गुरुवार संध्या तक महाप्रबंधक कार्यालय को भेजे जा सकते हैं।',
  ],
};

/* -- Shorthands ------------------------------------------------------------ */

function bilingual(en: string, hi: string): Localised<string> {
  return { en, hi };
}

function solution(...lines: [string, string][]): Localised<string[]> {
  return { en: lines.map(([en]) => en), hi: lines.map(([, hi]) => hi) };
}

/** Selecting a paragraph, as a solution step reads it. */
const SELECT_STEPS: Record<number, [string, string]> = {
  1: ['Select the first paragraph.', 'पहले पैराग्राफ को चुनें।'],
  2: ['Select the second paragraph.', 'दूसरे पैराग्राफ को चुनें।'],
  3: ['Select the third paragraph.', 'तीसरे पैराग्राफ को चुनें।'],
  4: ['Select the fourth paragraph.', 'चौथे पैराग्राफ को चुनें।'],
  5: ['Select the fifth paragraph.', 'पाँचवें पैराग्राफ को चुनें।'],
};

/* -- Paper 4 --------------------------------------------------------------- */

const PAPER_4_QUESTIONS: WordQuestionDraft[] = [
  {
    subject: 'word',
    number: 1,
    topic: 'Find and Replace, Font',
    difficulty: 'Hard',
    marks: 2,
    instruction: bilingual(
      "Replace 'MSP' with 'MRP' wherever it appears in the document, then make it bold and give it a wavy underline.",
      "डॉक्यूमेंट में जहाँ भी 'MSP' हो उसे 'MRP' में बदलें, फिर उसे बोल्ड और वेव (wavy) अंडरलाइन करें।",
    ),
    lines: NOTICE,
    // Two steps, and the order matters: the replacement happens first, and the
    // formatting is then applied to the word that replaced it.
    scope: 'all',
    operations: [],
    steps: [
      { scope: 'all', operations: [{ kind: 'replaceText', find: 'MSP', replacement: 'MRP' }] },
      {
        scope: { select: 'text', text: 'MRP', occurrence: 'all' },
        operations: [{ kind: 'bold' }, { kind: 'underlineStyle', style: 'wavy' }],
      },
    ],
    solution: solution(
      ['Open Home → Replace, and replace MSP with MRP throughout.', 'होम → रिप्लेस खोलें और MSP को MRP से बदलें।'],
      ['Select each MRP and press Bold.', 'प्रत्येक MRP को चुनें और बोल्ड दबाएँ।'],
      ['Open the Underline arrow and choose the wavy line.', 'अंडरलाइन के तीर से वेव लाइन चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 2,
    topic: 'Font colour',
    difficulty: 'Medium',
    marks: 1,
    instruction: bilingual(
      'Remove the blue colour from the text of the second paragraph.',
      'दूसरे पैराग्राफ के टेक्स्ट का नीला (blue) रंग दूर करें।',
    ),
    lines: NOTICE,
    // The paragraph arrives blue; without that the question asks for nothing.
    initial: [{ scope: { select: 'paragraph', index: 2 }, operations: [{ kind: 'fontColor', color: '#0000ff' }] }],
    scope: { select: 'paragraph', index: 2 },
    operations: [{ kind: 'removeFontColor' }],
    solution: solution(
      SELECT_STEPS[2]!,
      ['Open Font Colour and choose Automatic.', 'फ़ॉन्ट कलर खोलकर ऑटोमैटिक चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 3,
    topic: 'Paragraph borders',
    difficulty: 'Medium',
    marks: 1,
    // Stands in for "add a blank column to the table": the document model has
    // no table structure operations, so that question cannot be marked.
    instruction: bilingual(
      'Apply a bottom border to the fifth paragraph.',
      'पाँचवें पैराग्राफ पर नीचे (bottom) बॉर्डर लगाएँ।',
    ),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 5 },
    operations: [{ kind: 'border', edge: 'bottom' }],
    solution: solution(
      SELECT_STEPS[5]!,
      ['Open the Borders menu and choose Bottom Border.', 'बॉर्डर मेन्यू से बॉटम बॉर्डर चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 4,
    topic: 'Font size',
    difficulty: 'Easy',
    marks: 1,
    instruction: bilingual(
      'Set the font size of the fourth paragraph to 20 pt.',
      'चौथे पैराग्राफ की फ़ॉन्ट साइज़ 20pt सेट करें।',
    ),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 4 },
    operations: [{ kind: 'fontSize', size: 20 }],
    solution: solution(SELECT_STEPS[4]!, ['Type 20 in the font size box.', 'फ़ॉन्ट साइज़ बॉक्स में 20 लिखें।']),
  },
  {
    subject: 'word',
    number: 5,
    topic: 'Highlight',
    difficulty: 'Medium',
    marks: 1,
    instruction: bilingual(
      'Highlight the first paragraph in any colour except yellow.',
      'पहले पैराग्राफ को किसी भी रंग से हाईलाइट करें, लेकिन पीले (yellow) रंग का उपयोग न करें।',
    ),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 1 },
    operations: [{ kind: 'highlightAny', except: '#ffff00' }],
    solution: solution(
      SELECT_STEPS[1]!,
      ['Open Text Highlight Colour and pick any colour but yellow.', 'हाईलाइट कलर खोलें और पीले के अलावा कोई रंग चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 6,
    topic: 'Alignment',
    difficulty: 'Easy',
    marks: 1,
    // Stands in for "centre the text of the table's first row".
    instruction: bilingual(
      'Centre the text of the first paragraph.',
      'पहले पैराग्राफ के टेक्स्ट को केंद्र (center) में संरेखित करें।',
    ),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 1 },
    operations: [{ kind: 'align', align: 'center' }],
    solution: solution(SELECT_STEPS[1]!, ['Press Center in the Paragraph group.', 'पैराग्राफ समूह में सेंटर दबाएँ।']),
  },
  {
    subject: 'word',
    number: 7,
    topic: 'Italic',
    difficulty: 'Easy',
    marks: 1,
    // Stands in for "italicise the fourth column of the table".
    instruction: bilingual('Italicise the third paragraph.', 'तीसरे पैराग्राफ को इटैलिक करें।'),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 3 },
    operations: [{ kind: 'italic' }],
    solution: solution(SELECT_STEPS[3]!, ['Press Italic.', 'इटैलिक दबाएँ।']),
  },
  {
    subject: 'word',
    number: 8,
    topic: 'Font colour',
    difficulty: 'Easy',
    marks: 1,
    // Stands in for "set the second row's background colour to red".
    instruction: bilingual(
      'Set the font colour of the second paragraph to red.',
      'दूसरे पैराग्राफ के टेक्स्ट का रंग लाल (red) सेट करें।',
    ),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 2 },
    operations: [{ kind: 'fontColor', color: '#ff0000' }],
    solution: solution(SELECT_STEPS[2]!, ['Open Font Colour and choose red.', 'फ़ॉन्ट कलर से लाल रंग चुनें।']),
  },
  {
    subject: 'word',
    number: 9,
    topic: 'Underline styles',
    difficulty: 'Medium',
    marks: 1,
    instruction: bilingual(
      'Apply a wave underline to the fourth paragraph.',
      'चौथे पैराग्राफ को वेव अंडरलाइन (wave underline) करें।',
    ),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 4 },
    operations: [{ kind: 'underlineStyle', style: 'wavy' }],
    solution: solution(
      SELECT_STEPS[4]!,
      ['Open the Underline arrow and choose the wavy line.', 'अंडरलाइन के तीर से वेव लाइन चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 10,
    topic: 'Alignment',
    difficulty: 'Easy',
    marks: 1,
    // Stands in for "centre the text of the table's third column".
    instruction: bilingual('Justify the third paragraph.', 'तीसरे पैराग्राफ को जस्टिफ़ाई करें।'),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 3 },
    operations: [{ kind: 'align', align: 'justify' }],
    solution: solution(SELECT_STEPS[3]!, ['Press Justify.', 'जस्टिफ़ाई दबाएँ।']),
  },
  {
    subject: 'word',
    number: 11,
    topic: 'Indentation',
    difficulty: 'Medium',
    marks: 1,
    // Stands in for "indent the cell at row 2, column 1 by 0.5 inches".
    instruction: bilingual(
      'Give the second paragraph a left indent of 0.5 inches.',
      'दूसरे पैराग्राफ को 0.5 इंच का बायाँ इंडेंट दें।',
    ),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 2 },
    operations: [{ kind: 'indentLeft', cm: 0.5, unit: 'inch' }],
    solution: solution(
      SELECT_STEPS[2]!,
      ['Open the Paragraph dialog and set the left indent to 0.5".', 'पैराग्राफ डायलॉग में बायाँ इंडेंट 0.5" करें।'],
    ),
  },
  {
    subject: 'word',
    number: 12,
    topic: 'Bold and underline',
    difficulty: 'Easy',
    marks: 1,
    // Stands in for "bold and underline the table's fifth row".
    instruction: bilingual(
      'Make the fifth paragraph bold and underlined.',
      'पाँचवें पैराग्राफ के टेक्स्ट को बोल्ड और अंडरलाइन करें।',
    ),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 5 },
    operations: [{ kind: 'bold' }, { kind: 'underline' }],
    solution: solution(SELECT_STEPS[5]!, ['Press Bold, then Underline.', 'बोल्ड दबाएँ, फिर अंडरलाइन।']),
  },
  {
    subject: 'word',
    number: 13,
    topic: 'Highlight',
    difficulty: 'Easy',
    marks: 1,
    instruction: bilingual(
      'Highlight the third paragraph in teal.',
      'तीसरे पैराग्राफ को टील (teal) रंग से हाईलाइट करें।',
    ),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 3 },
    operations: [{ kind: 'highlight', color: '#008080' }],
    solution: solution(
      SELECT_STEPS[3]!,
      ['Open Text Highlight Colour and choose teal.', 'हाईलाइट कलर से टील रंग चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 14,
    topic: 'Paragraph borders',
    difficulty: 'Medium',
    marks: 1,
    // Stands in for "put a page border on the first page only": page settings
    // are not part of the document the marker sees.
    instruction: bilingual(
      'Put a border on all four sides of the first paragraph.',
      'पहले पैराग्राफ के चारों ओर बॉर्डर लगाएँ।',
    ),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 1 },
    operations: [{ kind: 'border', edge: 'all' }],
    solution: solution(
      SELECT_STEPS[1]!,
      ['Open the Borders menu and choose All Borders.', 'बॉर्डर मेन्यू से ऑल बॉर्डर चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 15,
    topic: 'Styles',
    difficulty: 'Medium',
    marks: 1,
    // Stands in for the two header questions.
    instruction: bilingual(
      'Apply the Heading 1 style to the first paragraph.',
      'पहले पैराग्राफ पर हेडिंग 1 (Heading 1) स्टाइल लगाएँ।',
    ),
    lines: NOTICE,
    scope: { select: 'paragraph', index: 1 },
    operations: [{ kind: 'paragraphStyle', style: 'Heading1' }],
    solution: solution(
      SELECT_STEPS[1]!,
      ['Choose Heading 1 from the Styles gallery.', 'स्टाइल गैलरी से हेडिंग 1 चुनें।'],
    ),
  },
];

/* -- Paper 5 --------------------------------------------------------------- */

const PAPER_5_QUESTIONS: WordQuestionDraft[] = [
  {
    subject: 'word',
    number: 1,
    topic: 'Subscript',
    difficulty: 'Medium',
    marks: 1,
    instruction: bilingual(
      "Apply the subscript effect to the word 'Strategy' wherever it appears in the document.",
      "डॉक्यूमेंट में जहाँ भी 'Strategy' शब्द हो, उस पर सबस्क्रिप्ट प्रभाव लगाएँ।",
    ),
    lines: CIRCULAR,
    scope: { select: 'text', text: 'Strategy', occurrence: 'all' },
    operations: [{ kind: 'subscript' }],
    solution: solution(
      ['Select each occurrence of Strategy.', "'Strategy' के प्रत्येक रूप को चुनें।"],
      ['Press Subscript in the Font group.', 'फ़ॉन्ट समूह में सबस्क्रिप्ट दबाएँ।'],
    ),
  },
  {
    subject: 'word',
    number: 2,
    topic: 'Font family',
    difficulty: 'Easy',
    marks: 1,
    instruction: bilingual(
      "Change the font of the second paragraph to 'Times New Roman'.",
      "दूसरे पैराग्राफ का फ़ॉन्ट 'Times New Roman' में बदलें।",
    ),
    lines: CIRCULAR,
    scope: { select: 'paragraph', index: 2 },
    operations: [{ kind: 'fontFamily', family: 'Times New Roman' }],
    solution: solution(
      SELECT_STEPS[2]!,
      ['Choose Times New Roman in the font box.', 'फ़ॉन्ट बॉक्स में Times New Roman चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 3,
    topic: 'Highlight',
    difficulty: 'Medium',
    marks: 1,
    instruction: bilingual(
      'Remove the highlight from the third paragraph.',
      'तीसरे पैराग्राफ का हाईलाइट हटाएँ।',
    ),
    lines: CIRCULAR,
    initial: [
      { scope: { select: 'paragraph', index: 3 }, operations: [{ kind: 'highlight', color: '#ffff00' }] },
    ],
    scope: { select: 'paragraph', index: 3 },
    operations: [{ kind: 'removeHighlight' }],
    solution: solution(
      SELECT_STEPS[3]!,
      ['Open Text Highlight Colour and choose No Colour.', 'हाईलाइट कलर खोलकर नो कलर चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 4,
    topic: 'Alignment',
    difficulty: 'Easy',
    marks: 1,
    instruction: bilingual(
      'Align the text in the fourth paragraph to the right.',
      'चौथे पैराग्राफ के टेक्स्ट को दाएँ (right) संरेखित करें।',
    ),
    lines: CIRCULAR,
    scope: { select: 'paragraph', index: 4 },
    operations: [{ kind: 'align', align: 'right' }],
    solution: solution(SELECT_STEPS[4]!, ['Press Align Text Right.', 'अलाइन टेक्स्ट राइट दबाएँ।']),
  },
  {
    subject: 'word',
    number: 5,
    topic: 'Underline styles',
    difficulty: 'Medium',
    marks: 1,
    instruction: bilingual(
      "Apply a double underline to the word 'Innovation' wherever it occurs.",
      "जहाँ भी 'Innovation' शब्द आए, उस पर डबल अंडरलाइन लगाएँ।",
    ),
    lines: CIRCULAR,
    scope: { select: 'text', text: 'Innovation', occurrence: 'all' },
    operations: [{ kind: 'underlineStyle', style: 'double' }],
    solution: solution(
      ['Select each occurrence of Innovation.', "'Innovation' के प्रत्येक रूप को चुनें।"],
      ['Open the Underline arrow and choose the double line.', 'अंडरलाइन के तीर से डबल लाइन चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 6,
    topic: 'Indentation',
    difficulty: 'Medium',
    marks: 1,
    instruction: bilingual(
      'Set the left indent of the first paragraph to 1.1 inches.',
      'पहले पैराग्राफ का बायाँ इंडेंट 1.1 इंच सेट करें।',
    ),
    lines: CIRCULAR,
    scope: { select: 'paragraph', index: 1 },
    operations: [{ kind: 'indentLeft', cm: 1.1, unit: 'inch' }],
    solution: solution(
      SELECT_STEPS[1]!,
      ['Open the Paragraph dialog and set the left indent to 1.1".', 'पैराग्राफ डायलॉग में बायाँ इंडेंट 1.1" करें।'],
    ),
  },
  {
    subject: 'word',
    number: 7,
    topic: 'Paragraph spacing',
    difficulty: 'Medium',
    marks: 1,
    // Stands in for "insert page numbers starting at 3": page settings are not
    // part of the document the marker sees.
    instruction: bilingual(
      'Set 12 pt of space after the first paragraph.',
      'पहले पैराग्राफ के बाद 12pt स्थान (space after) सेट करें।',
    ),
    lines: CIRCULAR,
    scope: { select: 'paragraph', index: 1 },
    operations: [{ kind: 'spaceAfter', points: 12 }],
    solution: solution(
      SELECT_STEPS[1]!,
      ['Open the Paragraph dialog and set Spacing After to 12 pt.', 'पैराग्राफ डायलॉग में आफ्टर 12pt करें।'],
    ),
  },
  {
    subject: 'word',
    number: 8,
    topic: 'Paragraph borders',
    difficulty: 'Medium',
    marks: 1,
    instruction: bilingual(
      'Apply an outside border to the second paragraph.',
      'दूसरे पैराग्राफ पर बाहरी (outside) बॉर्डर लगाएँ।',
    ),
    lines: CIRCULAR,
    scope: { select: 'paragraph', index: 2 },
    operations: [{ kind: 'border', edge: 'all' }],
    solution: solution(
      SELECT_STEPS[2]!,
      ['Open the Borders menu and choose All Borders.', 'बॉर्डर मेन्यू से ऑल बॉर्डर चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 9,
    topic: 'Paragraph borders',
    difficulty: 'Hard',
    marks: 2,
    instruction: bilingual(
      'Apply an outside border to the second paragraph and set its colour to red.',
      'दूसरे पैराग्राफ पर बाहरी बॉर्डर लगाकर उसका रंग लाल (red) करें।',
    ),
    lines: CIRCULAR,
    scope: { select: 'paragraph', index: 2 },
    operations: [{ kind: 'border', edge: 'all', color: '#ff0000' }],
    solution: solution(
      SELECT_STEPS[2]!,
      ['Open Borders and Shading, choose a box border and set the colour to red.', 'बॉर्डर्स एंड शेडिंग में बॉक्स बॉर्डर चुनें और रंग लाल करें।'],
    ),
  },
  {
    subject: 'word',
    number: 10,
    topic: 'Line spacing',
    difficulty: 'Hard',
    marks: 1,
    // Stands in for "set the table's border width to 3 pt".
    instruction: bilingual(
      'Set the line spacing of the fifth paragraph to exactly 18 pt.',
      'पाँचवें पैराग्राफ की लाइन स्पेसिंग ठीक (exactly) 18pt सेट करें।',
    ),
    lines: CIRCULAR,
    scope: { select: 'paragraph', index: 5 },
    operations: [{ kind: 'lineSpacingAt', mode: 'exactly', points: 18 }],
    solution: solution(
      SELECT_STEPS[5]!,
      ['In the Paragraph dialog choose Exactly and type 18 pt.', 'पैराग्राफ डायलॉग में एक्ज़ैक्टली चुनकर 18pt लिखें।'],
    ),
  },
  {
    subject: 'word',
    number: 11,
    topic: 'Character effects',
    difficulty: 'Medium',
    marks: 1,
    // Stands in for "set the watermark text to Confidential".
    instruction: bilingual(
      'Apply All caps to the first sentence of the fourth paragraph.',
      'चौथे पैराग्राफ के पहले वाक्य पर ऑल कैप्स (All caps) लगाएँ।',
    ),
    lines: CIRCULAR,
    scope: { select: 'sentence', index: 1, paragraph: 4 },
    operations: [{ kind: 'caps', caps: 'all' }],
    solution: solution(
      ['Select the first sentence of the fourth paragraph.', 'चौथे पैराग्राफ का पहला वाक्य चुनें।'],
      ['Open the Font dialog and tick All caps.', 'फ़ॉन्ट डायलॉग खोलकर ऑल कैप्स चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 12,
    topic: 'Character effects',
    difficulty: 'Medium',
    marks: 1,
    // Stands in for "make the watermark horizontal".
    instruction: bilingual(
      'Apply Small caps to the first word of the second paragraph.',
      'दूसरे पैराग्राफ के पहले शब्द पर स्मॉल कैप्स (Small caps) लगाएँ।',
    ),
    lines: CIRCULAR,
    scope: { select: 'word', index: 1, paragraph: 2 },
    operations: [{ kind: 'caps', caps: 'small' }],
    solution: solution(
      ['Select the first word of the second paragraph.', 'दूसरे पैराग्राफ का पहला शब्द चुनें।'],
      ['Open the Font dialog and tick Small caps.', 'फ़ॉन्ट डायलॉग खोलकर स्मॉल कैप्स चुनें।'],
    ),
  },
  {
    subject: 'word',
    number: 13,
    topic: 'Indentation',
    difficulty: 'Hard',
    marks: 1,
    // Stands in for "set the gutter margin to the top, 0.5 inches".
    instruction: bilingual(
      'Give the third paragraph a hanging indent of 0.5 inches.',
      'तीसरे पैराग्राफ को 0.5 इंच का हैंगिंग इंडेंट दें।',
    ),
    lines: CIRCULAR,
    scope: { select: 'paragraph', index: 3 },
    operations: [{ kind: 'firstLineIndent', special: 'hanging', cm: 0.5, unit: 'inch' }],
    solution: solution(
      SELECT_STEPS[3]!,
      ['In the Paragraph dialog choose Hanging and type 0.5".', 'पैराग्राफ डायलॉग में हैंगिंग चुनकर 0.5" लिखें।'],
    ),
  },
  {
    subject: 'word',
    number: 14,
    topic: 'Lists',
    difficulty: 'Hard',
    marks: 2,
    instruction: bilingual(
      'Apply a numbered list format to the first, second and fourth paragraphs.',
      'पहले, दूसरे और चौथे पैराग्राफ पर क्रमांकित (numbered) सूची लगाएँ।',
    ),
    lines: CIRCULAR,
    // Three selections, one question — what `steps` is for.
    scope: 'all',
    operations: [],
    steps: [
      { scope: { select: 'paragraph', index: 1 }, operations: [{ kind: 'list', list: 'ordered' }] },
      { scope: { select: 'paragraph', index: 2 }, operations: [{ kind: 'list', list: 'ordered' }] },
      { scope: { select: 'paragraph', index: 4 }, operations: [{ kind: 'list', list: 'ordered' }] },
    ],
    solution: solution(
      ['Select the first paragraph and press Numbering.', 'पहला पैराग्राफ चुनकर नंबरिंग दबाएँ।'],
      ['Repeat for the second and the fourth paragraphs.', 'दूसरे और चौथे पैराग्राफ पर दोहराएँ।'],
    ),
  },
  {
    subject: 'word',
    number: 15,
    topic: 'Lists',
    difficulty: 'Medium',
    marks: 1,
    instruction: bilingual(
      'Change the third paragraph from a numbered list to a bulleted list.',
      'तीसरे पैराग्राफ की क्रमांकित सूची को बुलेट सूची में बदलें।',
    ),
    lines: CIRCULAR,
    initial: [{ scope: { select: 'paragraph', index: 3 }, operations: [{ kind: 'list', list: 'ordered' }] }],
    scope: { select: 'paragraph', index: 3 },
    operations: [{ kind: 'list', list: 'bullet' }],
    solution: solution(SELECT_STEPS[3]!, ['Press Bullets.', 'बुलेट्स दबाएँ।']),
  },
];

export const WORD_EFFICIENCY_4: WordPaper = {
  name: 'Word Efficiency Test : 4',
  slug: 'word-efficiency-test-4',
  tagline: 'Formatting drill on a district notice — replace, highlight, underline, indent.',
  sectionName: 'Word Processing',
  durationMinutes: 20,
  qualifyingMarks: 7,
  questions: PAPER_4_QUESTIONS,
};

export const WORD_EFFICIENCY_5: WordPaper = {
  name: 'Word Efficiency Test : 5',
  slug: 'word-efficiency-test-5',
  tagline: 'Formatting drill on a company circular — effects, borders, spacing, lists.',
  sectionName: 'Word Processing',
  durationMinutes: 20,
  qualifyingMarks: 8,
  questions: PAPER_5_QUESTIONS,
};

export const WORD_EFFICIENCY_PAPERS: WordPaper[] = [WORD_EFFICIENCY_4, WORD_EFFICIENCY_5];
