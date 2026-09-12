import type { Localised } from './types';

/**
 * What the candidate is told before the paper opens.
 *
 * Every line here is checked against what the app actually does. An instruction
 * screen that describes a different product is worse than none: the candidate
 * plans around it and is then surprised mid-paper. Where a familiar convention
 * does not apply — this paper has no "not visited" state, and flagging a
 * question for review changes nothing about how it is marked — the text says so
 * rather than repeating the convention.
 */

export interface PaletteKey {
  /** Which swatch the row draws. */
  state: 'unattempted' | 'attempted' | 'review' | 'attemptedReview';
  name: Localised<string>;
  meaning: Localised<string>;
}

export const EXAM_INSTRUCTIONS: Localised<string[]> = {
  en: [
    'You have 10 minutes to complete the test.',
    'The time remaining is shown in the panel on the right and counts down until it reaches zero.',
    'The test is submitted automatically when the time runs out. You do not have to submit it yourself.',
    'Your result is shown immediately after submission, with worked solutions for every question.',
    'Move between questions with Previous and Next, or by picking a number from the palette on the right.',
    'Each question has its own document. Your edits are kept as you move between questions, so nothing has to be saved.',
    'Every formatting action must be performed from the ribbon. Keyboard shortcuts such as Ctrl+B do not apply formatting in this test.',
    'Apply only the formatting the question asks for. Anything extra makes the answer wrong.',
  ],
  hi: [
    'टेस्ट पूरा करने के लिए आपके पास 10 मिनट हैं।',
    'बचा हुआ समय दाईं ओर के पैनल में दिखता है और शून्य तक घटता रहता है।',
    'समय समाप्त होते ही टेस्ट अपने आप सबमिट हो जाएगा। आपको स्वयं सबमिट करने की आवश्यकता नहीं है।',
    'सबमिट होते ही आपका परिणाम दिखाया जाएगा, साथ में हर प्रश्न का हल भी।',
    'प्रश्नों के बीच जाने के लिए Previous और Next का उपयोग करें, या दाईं ओर पैलेट से कोई नंबर चुनें।',
    'हर प्रश्न का अपना अलग डॉक्यूमेंट है। प्रश्न बदलने पर आपके बदलाव सुरक्षित रहते हैं, इसलिए कुछ भी सेव करने की ज़रूरत नहीं है।',
    'हर फॉर्मेटिंग रिबन से ही करनी है। इस टेस्ट में Ctrl+B जैसे कीबोर्ड शॉर्टकट फॉर्मेटिंग नहीं करते।',
    'केवल वही फॉर्मेटिंग करें जो प्रश्न में पूछी गई है। कोई भी अतिरिक्त फॉर्मेटिंग उत्तर को गलत बना देती है।',
  ],
};

/**
 * The Excel paper's rules.
 *
 * The same eight points, reworded for a spreadsheet: a workbook rather than a
 * document, and the ribbon rule stated in Excel's terms. Held separately rather
 * than generated from the Word set by substitution, because these are the words
 * a candidate is held to — they should be written, not derived.
 */
export const EXCEL_INSTRUCTIONS: Localised<string[]> = {
  en: [
    'You have 15 minutes to complete the test.',
    'The time remaining is shown in the panel on the right and counts down until it reaches zero.',
    'The test is submitted automatically when the time runs out. You do not have to submit it yourself.',
    'Your result is shown immediately after submission, with worked solutions for every question.',
    'Move between questions with Previous and Next, or by picking a number from the palette on the right.',
    'Each question has its own workbook. Your work is kept as you move between questions, so nothing has to be saved.',
    'Every formatting action must be performed from the ribbon. Keyboard shortcuts such as Ctrl+B do not apply formatting in this test.',
    'Do only what the question asks for. Any extra formatting, or a change to a cell the question did not mention, makes the answer wrong.',
  ],
  hi: [
    'टेस्ट पूरा करने के लिए आपके पास 15 मिनट हैं।',
    'बचा हुआ समय दाईं ओर के पैनल में दिखता है और शून्य तक घटता रहता है।',
    'समय समाप्त होते ही टेस्ट अपने आप सबमिट हो जाएगा। आपको स्वयं सबमिट करने की आवश्यकता नहीं है।',
    'सबमिट होते ही आपका परिणाम दिखाया जाएगा, साथ में हर प्रश्न का हल भी।',
    'प्रश्नों के बीच जाने के लिए Previous और Next का उपयोग करें, या दाईं ओर पैलेट से कोई नंबर चुनें।',
    'हर प्रश्न की अपनी अलग वर्कबुक है। प्रश्न बदलने पर आपका काम सुरक्षित रहता है, इसलिए कुछ भी सेव करने की ज़रूरत नहीं है।',
    'हर फॉर्मेटिंग रिबन से ही करनी है। इस टेस्ट में Ctrl+B जैसे कीबोर्ड शॉर्टकट फॉर्मेटिंग नहीं करते।',
    'केवल वही करें जो प्रश्न में पूछा गया है। कोई भी अतिरिक्त फॉर्मेटिंग, या किसी ऐसे सेल में बदलाव जिसका प्रश्न में ज़िक्र नहीं है, उत्तर को गलत बना देता है।',
  ],
};

/**
 * The palette's four states.
 *
 * There is deliberately no "not visited": whether a question counts as
 * attempted is derived from the document, so opening a question and leaving it
 * alone is the same as never opening it.
 */
export const PALETTE_KEY: PaletteKey[] = [
  {
    state: 'unattempted',
    name: { en: 'Not Attempted', hi: 'प्रयास नहीं किया' },
    meaning: {
      en: 'The document for this question has not been changed. Opening a question is not enough.',
      hi: 'इस प्रश्न का डॉक्यूमेंट नहीं बदला गया है। केवल प्रश्न खोलना पर्याप्त नहीं है।',
    },
  },
  {
    state: 'attempted',
    name: { en: 'Attempted', hi: 'प्रयास किया' },
    meaning: {
      en: 'You have edited this question’s document. It will be marked.',
      hi: 'आपने इस प्रश्न का डॉक्यूमेंट संपादित किया है। इसकी जाँच की जाएगी।',
    },
  },
  {
    state: 'review',
    name: { en: 'Marked for Review', hi: 'समीक्षा के लिए चिह्नित' },
    meaning: {
      en: 'You have flagged this question to come back to. Flagging changes nothing about how it is marked.',
      hi: 'आपने इस प्रश्न को बाद में देखने के लिए चिह्नित किया है। चिह्नित करने से जाँच पर कोई फर्क नहीं पड़ता।',
    },
  },
  {
    state: 'attemptedReview',
    name: { en: 'Attempted & Marked for Review', hi: 'प्रयास किया और समीक्षा के लिए चिह्नित' },
    meaning: {
      en: 'Edited and flagged. It is marked exactly like any other edited question.',
      hi: 'संपादित और चिह्नित। इसकी जाँच किसी भी अन्य संपादित प्रश्न की तरह ही होती है।',
    },
  },
];

/**
 * The same four states, for a paper sat in the spreadsheet.
 *
 * Only the two rows that name the artefact differ; the review rows are already
 * subject-neutral and are reused rather than restated, so a change to how
 * flagging works cannot be fixed in one list and missed in the other.
 */
export const EXCEL_PALETTE_KEY: PaletteKey[] = PALETTE_KEY.map((entry) => {
  if (entry.state === 'unattempted') {
    return {
      ...entry,
      meaning: {
        en: 'The workbook for this question has not been changed. Opening a question is not enough.',
        hi: 'इस प्रश्न की वर्कबुक नहीं बदली गई है। केवल प्रश्न खोलना पर्याप्त नहीं है।',
      },
    };
  }

  if (entry.state === 'attempted') {
    return {
      ...entry,
      meaning: {
        en: 'You have changed this question’s workbook. It will be marked.',
        hi: 'आपने इस प्रश्न की वर्कबुक बदली है। इसकी जाँच की जाएगी।',
      },
    };
  }

  return entry;
});

export const TERMS: Localised<string[]> = {
  en: [
    'You will attempt this test on your own and will not use any unfair means.',
    'The test must be completed within the 10 minutes allowed.',
    'Once the timer reaches zero the test is submitted automatically.',
    'After submission your result and a question-by-question review are available.',
  ],
  hi: [
    'आप यह टेस्ट स्वयं देंगे और किसी अनुचित साधन का प्रयोग नहीं करेंगे।',
    'टेस्ट निर्धारित 10 मिनट में पूरा करना होगा।',
    'टाइमर शून्य होते ही टेस्ट अपने आप सबमिट हो जाएगा।',
    'सबमिट होने के बाद आपका परिणाम और प्रश्नवार समीक्षा उपलब्ध होगी।',
  ],
};

/**
 * The same terms for the Excel paper, which runs to fifteen minutes.
 *
 * The duration is written into the sentence rather than derived from
 * `attempt.durationSeconds`, which is how the Word set already reads. Two
 * papers is where that starts to bite, so this is the point at which a
 * mismatch would show — hence a separate list rather than a shared one with a
 * number that is wrong for one of them.
 */
export const EXCEL_TERMS: Localised<string[]> = {
  en: TERMS.en.map((term) => term.replace('10 minutes', '15 minutes')),
  hi: TERMS.hi.map((term) => term.replace('10 मिनट', '15 मिनट')),
};

/** Everything the screen says, in one place, so the page is presentation only. */
export const INSTRUCTION_COPY = {
  subtitle: {
    en: 'Read the instructions carefully before starting the test.',
    hi: 'टेस्ट शुरू करने से पहले निर्देश ध्यान से पढ़ें।',
  },
  duration: { en: 'Duration', hi: 'अवधि' },
  minutes: { en: 'Minutes', hi: 'मिनट' },
  totalQuestions: { en: 'Total Questions', hi: 'कुल प्रश्न' },
  totalMarks: { en: 'Total Marks', hi: 'कुल अंक' },
  qualifyingMarks: { en: 'Qualifying Marks', hi: 'उत्तीर्ण अंक' },
  instructionsTitle: { en: 'Exam Instructions', hi: 'परीक्षा निर्देश' },
  paletteTitle: { en: 'Question Status in Palette', hi: 'पैलेट में प्रश्न की स्थिति' },
  paletteSubtitle: {
    en: 'The questions on the right side show these states:',
    hi: 'दाईं ओर के प्रश्न ये स्थितियाँ दिखाते हैं:',
  },
  paletteNote: {
    en: 'There is no separate “not visited” state. A question counts as attempted only once its document has been changed.',
    hi: '“नहीं देखा गया” जैसी कोई अलग स्थिति नहीं है। प्रश्न तभी प्रयास किया गया माना जाता है जब उसका डॉक्यूमेंट बदला गया हो।',
  },
  paletteNoteExcel: {
    en: 'There is no separate “not visited” state. A question counts as attempted only once its workbook has been changed.',
    hi: '“नहीं देखा गया” जैसी कोई अलग स्थिति नहीं है। प्रश्न तभी प्रयास किया गया माना जाता है जब उसकी वर्कबुक बदली गई हो।',
  },
  languageTitle: { en: 'Select Your Test Language', hi: 'अपनी टेस्ट भाषा चुनें' },
  languageBody: {
    en: 'The paper is sat in one language. Choose it now — it cannot be changed once the test starts.',
    hi: 'पेपर एक ही भाषा में दिया जाता है। इसे अभी चुनें — टेस्ट शुरू होने के बाद इसे बदला नहीं जा सकता।',
  },
  instructionsLanguage: { en: 'Instructions Language', hi: 'निर्देश की भाषा' },
  termsTitle: { en: 'Terms & Conditions', hi: 'नियम एवं शर्तें' },
  agree: {
    en: 'I have read and understood the instructions and agree to the Terms & Conditions of this test.',
    hi: 'मैंने निर्देश पढ़ और समझ लिए हैं तथा इस टेस्ट की नियम एवं शर्तों से सहमत हूँ।',
  },
  back: { en: 'Back to Tests', hi: 'टेस्ट सूची पर वापस' },
  start: { en: 'Start Test', hi: 'टेस्ट शुरू करें' },
  agreeFirst: {
    en: 'Tick the box above to start.',
    hi: 'शुरू करने के लिए ऊपर दिए बॉक्स पर टिक करें।',
  },
} satisfies Record<string, Localised<string>>;
