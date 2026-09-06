import type { JSONContent } from '@tiptap/core';
import { INDENT_STEP_PX } from '@/utils/indent';
import type {
  Difficulty,
  ExamAttempt,
  ExamQuestion,
  Language,
  Localised,
  ModelAnswer,
} from './types';

/**
 * The demo paper: Word-operation tasks, in Hindi and English.
 *
 * Each question gives a passage and asks for one operation on it. The passage
 * is the whole answer document — the instruction lives outside the editor — so
 * everything in the document is under test.
 *
 * The passages are English in both languages; only the instruction is
 * translated. Two questions address a wrapped line by character offset (see
 * `questionBank.ts`), and those offsets only hold for one wording, so the
 * passage cannot vary by language.
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

/*
 * The passages. Several questions reuse one, which is deliberate: the same text
 * under a different instruction makes the operation, not the reading, the thing
 * being tested.
 */

const TOWN =
  'The afternoon drifted quietly across the town, carrying warm air through half-open windows and stirring the pages of an unfinished notebook. Somewhere beyond the old market, a bicycle bell rang twice, followed by the distant sound of a bus turning around the corner. Nobody seemed to be in a hurry. A shopkeeper arranged blue bottles on a wooden shelf, while a curious cat watched from beneath a parked scooter. In the nearby park, children invented complicated rules for a game that had no name, arguing loudly before laughing and starting again. Above them, clouds gathered like scattered pieces of paper, changing shape whenever the wind moved. On a rooftop, someone watered a row of small plants and checked the sky with hopeful eyes. The city continued its ordinary rhythm: phones buzzed, doors opened, cups clinked, and footsteps crossed dusty sidewalks. Yet for a few minutes, everything felt strangely peaceful. Perhaps quiet moments are easier to notice when nothing important is expected to happen. A forgotten coin, a cracked sign, a yellow flower growing beside a wall—small things can become memorable when attention slows down. By evening, the streets would become brighter, louder, and busier, but for now the town simply breathed beneath the pale afternoon sun, waiting for whatever tomorrow decided to bring.';

const RAIN =
  'Rain arrived without warning just after lunch, tapping softly against windows and turning the dusty road outside into a ribbon of silver. People hurried beneath umbrellas, while a few stood under shop awnings waiting for the clouds to pass. An old man carried a paper bag filled with vegetables, carefully balancing it beneath his coat. Across the street, a dog shook water from its fur and looked offended by the weather. Inside a small café, three friends continued their conversation as though the storm were part of the furniture. Steam rose from cups of tea, and someone played a quiet song from a phone near the counter. The rain became heavier for a while, covering every other sound in the neighborhood. Then, almost as suddenly as it had begun, it weakened. The clouds opened slightly, allowing a thin beam of sunlight to fall across the wet pavement. Cars moved again, bicycles appeared, and the street slowly returned to its usual rhythm. Nobody remembered exactly what they had been rushing toward, but everyone seemed happier to be moving again.';

const VILLAGE =
  'At the edge of the village stood a wooden house with a green door and a garden full of plants that seemed determined to grow in every direction. Nobody knew exactly how old the house was, although the oldest residents claimed that their grandparents had played near it as children. Every morning, a woman named Mira opened the windows, swept the front steps, and placed a small bowl of water beside the gate for passing animals. Birds often landed on the fence, and occasionally a sleepy dog wandered into the garden and refused to leave. The house was quiet except for the ticking clock in the hallway and the occasional creak of the wooden floor. In the evenings, neighbors gathered outside to exchange stories about weather, crops, distant relatives, and strange things they had seen on the road. Nothing particularly exciting happened, yet nobody seemed disappointed. Life there moved according to familiar patterns, and those patterns gave ordinary days a comfortable shape. When the sun disappeared behind the hills, the garden became dark and still, while the green door reflected the warm glow of a lamp inside.';

const STATION =
  'The train station was almost empty when the clock reached seven. A cleaner pushed a cart slowly along the platform, humming a tune that disappeared beneath the noise of an arriving train. A young traveler sat on a bench with a backpack between his feet and a folded map in his hands. He had changed his destination three times already and still was not completely sure where he wanted to go. Across the tracks, a woman read a newspaper while drinking coffee from a paper cup. The loudspeaker announced a delay, followed by a second announcement correcting the first one. Nobody reacted with surprise. Trains, like people, apparently had their own ideas about schedules. After twenty minutes, the traveler stood, stretched his legs, and looked toward the dark end of the platform. A small light appeared in the distance and slowly grew brighter. The train arrived with a long metallic sigh. Doors opened, passengers stepped out, and others climbed aboard. For a moment, the station became crowded and noisy. Then the doors closed, the train moved away, and silence returned as if nothing had happened.';

const STREET =
  'Somewhere in the middle of a crowded city was a narrow street that seemed to have been forgotten by modern time. The buildings were tall but slightly uneven, with balconies covered by plants and windows painted in colors that had faded over the years. A bakery occupied the corner, filling the street with the smell of fresh bread every morning. Next door was a tiny repair shop where the owner fixed watches, radios, lamps, and almost anything else people brought through the door. A handwritten sign in the window simply said, “If it can be repaired, bring it here.” Nobody knew whether the statement was completely true, but people liked the confidence behind it. At noon, delivery workers stopped for sandwiches, students bought pastries, and elderly residents sat on benches discussing the latest neighborhood rumors. By sunset, the street became quieter. Lights appeared behind curtains, the bakery closed its doors, and the repair shop owner finally turned off his desk lamp. The city remained noisy beyond the corner, but this little street seemed to exist at its own pace.';

const NOTEBOOK =
  'The notebook had been sitting inside the drawer for years, hidden beneath old receipts, broken pencils, and a collection of keys nobody could identify. Its cover was brown and scratched, with a tiny star drawn near one corner. When it was finally opened, the first few pages contained shopping lists and reminders about appointments. Later pages were filled with sketches, unfinished sentences, random numbers, and descriptions of places that no longer existed. There was a drawing of a house beside a lake, although nobody remembered owning a house near a lake. Another page described a blue bicycle, a red umbrella, and a mysterious bird that appeared every Thursday. The writing became less organized toward the end, but somehow more interesting. One sentence simply said, “Remember that ordinary days are not ordinary while they are happening.” The person reading it stopped for a moment. Outside, traffic moved along the road, someone laughed in the hallway, and a pressure cooker whistled in a nearby kitchen. Nothing unusual was happening. Yet the sentence made the familiar world feel slightly different, as though every small detail had been waiting quietly to be noticed.';

const LIBRARY =
  'The library closed at eight, but at seven fifty-five the building still contained a surprising amount of activity. Students hurried between shelves searching for final references, a professor typed notes at a corner desk, and two children whispered loudly enough to attract repeated warnings from their mother. Near the entrance, an old clock made a soft clicking sound every second. The librarian walked through the aisles, returning books to their places with the patience of someone who had performed the same task thousands of times. Outside, evening traffic had begun to glow beneath streetlights. Inside, the smell of paper and dust made the building feel separate from the city. At exactly eight, the librarian announced closing time. Chairs moved, bags were lifted, and books were carefully packed away. One student remained seated for a few extra seconds, staring at a page without reading it. Then she closed the book and smiled. She had not finished everything she planned to do, but perhaps that was acceptable. Some days were meant for completing tasks, while others were simply meant for making progress.';

/**
 * Where line 2 of the boat passage falls, as character offsets into it.
 *
 * Measured from the rendered page — see the note in
 * `src/server/marking/questionBank.ts`, which marks against this same range, as
 * does the model answer shown on the review screen. One constant, so the key
 * and the worked answer cannot disagree.
 */
export const BOAT_LINE_TWO = { from: 92, to: 178 } as const;

/**
 * Addressed by wrapped line in questions 8 and 13.
 *
 * Do not reword it without re-measuring `BOAT_LINE_TWO`.
 */
export const BOAT_PASSAGE =
  'A small boat rested on the shore, its wooden sides covered with layers of old paint. Nobody had used it since the previous summer, but every morning someone checked the ropes and moved it slightly above the reach of the waves. The sea was unusually calm that day. Far away, a group of birds moved together across the horizon, changing direction whenever the wind shifted. A boy walked along the beach collecting shells and pieces of smooth glass. He placed each discovery carefully into a blue bucket, although he had no plan for what to do with them later. His grandfather sat nearby beneath a faded umbrella and watched without saying much. Occasionally he pointed toward something floating in the water, and the boy would run closer to investigate. By afternoon, the bucket was nearly full. The boy looked at his collection proudly, then suddenly decided that he liked the beach better without it. One by one, he returned the shells to the sand. The glass pieces stayed in his pocket. Some things, he decided, were worth keeping.';

interface Draft {
  topic: string;
  difficulty: Difficulty;
  instruction: Localised<string>;
  passage: string;
  /** The ribbon route, step by step, shown on the solutions screen. */
  solution: Localised<string[]>;
  modelAnswer: ModelAnswer;
  marks: number;
}

/** Formatting applied to the whole paragraph, which is most of the paper. */
const whole = (marks: ModelAnswer['marks'], attrs?: ModelAnswer['attrs']): ModelAnswer => ({
  scope: 'all',
  ...(marks ? { marks } : {}),
  ...(attrs ? { attrs } : {}),
});

/** Formatting applied to the one wrapped line questions 8 and 13 name. */
const lineTwo = (marks: ModelAnswer['marks']): ModelAnswer => ({
  scope: { ...BOAT_LINE_TWO },
  marks,
});

/**
 * Every question starts by choosing what to format, so every solution starts
 * the same way. Questions 8 and 13 are the exceptions: they name one line.
 */
const SELECT_ALL: Localised<string> = {
  en: 'Select the whole paragraph — drag across it, or click Select All in the Editing group.',
  hi: 'पूरे पैराग्राफ को सेलेक्ट करें — उस पर ड्रैग करें, या Editing ग्रुप में Select All पर क्लिक करें।',
};

const SELECT_LINE_TWO: Localised<string> = {
  en: 'Drag across the second line of the paragraph — the line that begins “had used it”.',
  hi: 'पैराग्राफ की दूसरी लाइन पर ड्रैग करें — वह लाइन जो “had used it” से शुरू होती है।',
};

/** Builds a solution: the selection step, then the ribbon steps. */
function steps(first: Localised<string>, ...rest: Localised<string>[]): Localised<string[]> {
  return {
    en: [first.en, ...rest.map((step) => step.en)],
    hi: [first.hi, ...rest.map((step) => step.hi)],
  };
}

const DRAFTS: Draft[] = [
  {
    topic: "Character Formatting",
    difficulty: 'Easy',
    instruction: {
      hi: 'पैराग्राफ को बोल्ड करें, अंडरलाइन करें।',
      en: 'Make the paragraph bold and underline it.',
    },
    passage: TOWN,
    solution: steps(
      SELECT_ALL,
      { en: "On the Home tab, in the Font group, click Bold (B).", hi: "Home टैब के Font ग्रुप में Bold (B) पर क्लिक करें।" },
      { en: "Click Underline (U) in the same group.", hi: "उसी ग्रुप में Underline (U) पर क्लिक करें।" },
    ),
    modelAnswer: whole([{ type: 'bold' }, { type: 'underline' }]),
    marks: 4,
  },
  {
    topic: "Text Highlight",
    difficulty: 'Easy',
    instruction: {
      hi: 'पैराग्राफ को हरे रंग से हाइलाइट करें।',
      en: 'Highlight the paragraph with green color.',
    },
    passage: RAIN,
    solution: steps(
      SELECT_ALL,
      { en: "In the Font group, open the arrow beside Text Highlight Colour.", hi: "Font ग्रुप में Text Highlight Colour के बगल वाले तीर को खोलें।" },
      { en: "Pick the bright green swatch — the second colour in the top row.", hi: "चमकीला हरा स्वैच चुनें — ऊपर की पंक्ति का दूसरा रंग।" },
    ),
    modelAnswer: whole([{ type: 'highlight', attrs: { color: '#00ff00' } }]),
    marks: 3,
  },
  {
    topic: "Font",
    difficulty: 'Easy',
    instruction: {
      hi: 'पैराग्राफ का फॉन्ट टाइम्स न्यू रोमन में सेट करें।',
      en: 'Set the font of the paragraph to Times New Roman.',
    },
    passage: VILLAGE,
    solution: steps(
      SELECT_ALL,
      { en: "Open the Font name box in the Font group.", hi: "Font ग्रुप में Font name बॉक्स खोलें।" },
      { en: "Choose Times New Roman from the list.", hi: "सूची में से Times New Roman चुनें।" },
    ),
    modelAnswer: whole([{ type: 'textStyle', attrs: { fontFamily: 'Times New Roman' } }]),
    marks: 3,
  },
  {
    topic: "Font Size",
    difficulty: 'Medium',
    instruction: {
      hi: 'पैराग्राफ का फॉन्ट साइज 15 में सेट करें।',
      en: 'Set the font size of the paragraph to 15.',
    },
    passage: STATION,
    solution: steps(
      SELECT_ALL,
      { en: "Click inside the Font Size box in the Font group.", hi: "Font ग्रुप के Font Size बॉक्स में क्लिक करें।" },
      { en: "Type 15 and press Enter. 15 is not on the drop-down list, so it has to be typed.", hi: "15 टाइप करके Enter दबाएँ। 15 ड्रॉप-डाउन सूची में नहीं है, इसलिए इसे टाइप करना ज़रूरी है।" },
    ),
    modelAnswer: whole([{ type: 'textStyle', attrs: { fontSize: '15pt' } }]),
    marks: 3,
  },
  {
    topic: "Paragraph Alignment",
    difficulty: 'Easy',
    instruction: {
      hi: 'पैराग्राफ में सेंटर अलाइनमेंट अप्लाई करें।',
      en: 'Apply center alignment to the paragraph.',
    },
    passage: STREET,
    solution: steps(
      SELECT_ALL,
      { en: "On the Home tab, in the Paragraph group, click Center.", hi: "Home टैब के Paragraph ग्रुप में Center पर क्लिक करें।" },
    ),
    modelAnswer: whole(undefined, { textAlign: 'center' }),
    marks: 3,
  },
  {
    topic: "Line Spacing",
    difficulty: 'Medium',
    instruction: {
      hi: 'पैराग्राफ में लाइन स्पेसिंग 2.0 करें।',
      en: 'Set the line spacing of the paragraph to 2.0.',
    },
    passage: NOTEBOOK,
    solution: steps(
      SELECT_ALL,
      { en: "In the Paragraph group, open the Line Spacing menu.", hi: "Paragraph ग्रुप में Line Spacing मेन्यू खोलें।" },
      { en: "Choose 2.0.", hi: "2.0 चुनें।" },
    ),
    modelAnswer: whole(undefined, { lineHeight: 2 }),
    marks: 4,
  },
  {
    topic: "Paragraph Indent",
    difficulty: 'Medium',
    instruction: {
      hi: 'पैराग्राफ के इंडेंट को एक लेवल बढ़ाएं।',
      en: 'Increase the indent level of the paragraph by one level.',
    },
    passage: LIBRARY,
    solution: steps(
      SELECT_ALL,
      { en: "In the Paragraph group, click Increase Indent once.", hi: "Paragraph ग्रुप में Increase Indent पर एक बार क्लिक करें।" },
      { en: "One click is one level; a second click indents too far.", hi: "एक क्लिक एक लेवल है; दूसरा क्लिक ज़्यादा इंडेंट कर देगा।" },
    ),
    modelAnswer: whole(undefined, { indentLeft: INDENT_STEP_PX }),
    marks: 3,
  },
  {
    topic: "Line Selection",
    difficulty: 'Hard',
    instruction: {
      hi: 'डॉक्यूमेंट की 2वीं लाइन को अंडरलाइन करें।',
      en: 'Underline the 2nd line of the document.',
    },
    passage: BOAT_PASSAGE,
    solution: steps(
      SELECT_LINE_TWO,
      { en: "In the Font group, click Underline (U).", hi: "Font ग्रुप में Underline (U) पर क्लिक करें।" },
      { en: "Leave the rest of the passage untouched.", hi: "बाकी पैराग्राफ को वैसा ही छोड़ दें।" },
    ),
    modelAnswer: lineTwo([{ type: 'underline' }]),
    marks: 4,
  },
  {
    topic: "Font Size",
    difficulty: 'Easy',
    instruction: {
      hi: 'पैराग्राफ का फॉन्ट साइज 8 में सेट करें।',
      en: 'Set the font size of the paragraph to 8.',
    },
    passage: STATION,
    solution: steps(
      SELECT_ALL,
      { en: "Open the Font Size box in the Font group and choose 8.", hi: "Font ग्रुप में Font Size बॉक्स खोलकर 8 चुनें।" },
    ),
    modelAnswer: whole([{ type: 'textStyle', attrs: { fontSize: '8pt' } }]),
    marks: 3,
  },
  {
    topic: "Paragraph Alignment",
    difficulty: 'Easy',
    instruction: {
      hi: 'पैराग्राफ में justify अलाइनमेंट अप्लाई करें।',
      en: 'Apply justify alignment to the paragraph.',
    },
    passage: STREET,
    solution: steps(
      SELECT_ALL,
      { en: "On the Home tab, in the Paragraph group, click Justify.", hi: "Home टैब के Paragraph ग्रुप में Justify पर क्लिक करें।" },
    ),
    modelAnswer: whole(undefined, { textAlign: 'justify' }),
    marks: 3,
  },
  {
    topic: "Font",
    difficulty: 'Easy',
    instruction: {
      hi: 'पैराग्राफ का फॉन्ट Calibri में सेट करें।',
      en: 'Set the font of the paragraph to Calibri.',
    },
    passage: VILLAGE,
    solution: steps(
      SELECT_ALL,
      { en: "Open the Font name box in the Font group.", hi: "Font ग्रुप में Font name बॉक्स खोलें।" },
      { en: "Choose Calibri. It has to be chosen, not left as the default.", hi: "Calibri चुनें। इसे चुनना ज़रूरी है, डिफ़ॉल्ट पर छोड़ना काफी नहीं है।" },
    ),
    modelAnswer: whole([{ type: 'textStyle', attrs: { fontFamily: 'Calibri' } }]),
    marks: 3,
  },
  {
    topic: "Character Formatting",
    difficulty: 'Easy',
    instruction: {
      hi: 'पैराग्राफ को बोल्ड करें, italic करें।',
      en: 'Make the paragraph bold and italic it.',
    },
    passage: TOWN,
    solution: steps(
      SELECT_ALL,
      { en: "On the Home tab, in the Font group, click Bold (B).", hi: "Home टैब के Font ग्रुप में Bold (B) पर क्लिक करें।" },
      { en: "Click Italic (I) in the same group.", hi: "उसी ग्रुप में Italic (I) पर क्लिक करें।" },
    ),
    modelAnswer: whole([{ type: 'bold' }, { type: 'italic' }]),
    marks: 4,
  },
  {
    topic: "Line Selection",
    difficulty: 'Hard',
    instruction: {
      hi: 'डॉक्यूमेंट की 2वीं लाइन को red colour highlight करें।',
      en: 'Red colour highlight the 2nd line of the document.',
    },
    passage: BOAT_PASSAGE,
    solution: steps(
      SELECT_LINE_TWO,
      { en: "In the Font group, open the arrow beside Text Highlight Colour.", hi: "Font ग्रुप में Text Highlight Colour के बगल वाले तीर को खोलें।" },
      { en: "Pick red — the first colour in the second row.", hi: "लाल चुनें — दूसरी पंक्ति का पहला रंग।" },
    ),
    modelAnswer: lineTwo([{ type: 'highlight', attrs: { color: '#ff0000' } }]),
    marks: 4,
  },
  {
    topic: "Font Colour",
    difficulty: 'Easy',
    instruction: {
      hi: 'पैराग्राफ के text को red colour करें।',
      en: 'Change the text colour of paragraph to Red.',
    },
    passage: RAIN,
    solution: steps(
      SELECT_ALL,
      { en: "In the Font group, open the arrow beside Font Colour.", hi: "Font ग्रुप में Font Colour के बगल वाले तीर को खोलें।" },
      { en: "Pick red from the palette.", hi: "पैलेट में से लाल चुनें।" },
    ),
    modelAnswer: whole([{ type: 'textStyle', attrs: { color: '#ff0000' } }]),
    marks: 3,
  },
  {
    topic: "Character Formatting",
    difficulty: 'Easy',
    instruction: {
      hi: 'पैराग्राफ को बोल्ड करें।',
      en: 'Make the paragraph bold.',
    },
    passage: TOWN,
    solution: steps(
      SELECT_ALL,
      { en: "On the Home tab, in the Font group, click Bold (B).", hi: "Home टैब के Font ग्रुप में Bold (B) पर क्लिक करें।" },
      { en: "Apply nothing else — bold is the whole question.", hi: "और कुछ न लगाएँ — सवाल सिर्फ bold का है।" },
    ),
    modelAnswer: whole([{ type: 'bold' }]),
    marks: 3,
  },
];

function buildQuestions(): ExamQuestion[] {
  return DRAFTS.map((draft, index) => ({
    number: index + 1,
    topic: draft.topic,
    difficulty: draft.difficulty,
    instruction: draft.instruction,
    passage: { en: passage(draft.passage), hi: passage(draft.passage) },
    solution: draft.solution,
    modelAnswer: draft.modelAnswer,
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

/**
 * The passage as it looks once the question is answered correctly.
 *
 * Built by applying the model answer to the passage the candidate started
 * from, rather than by storing a second copy of the text: the worked answer
 * then cannot show different words from the question.
 */
export function modelAnswerDocument(question: ExamQuestion, language: Language): JSONContent {
  const { modelAnswer } = question;
  const source = question.passage[language];
  const [first, ...rest] = source.content ?? [];
  const text = first?.content?.[0]?.text ?? '';

  const marks = modelAnswer.marks;
  const run = (value: string, formatted: boolean): JSONContent => ({
    type: 'text',
    text: value,
    ...(formatted && marks ? { marks } : {}),
  });

  const content: JSONContent[] =
    modelAnswer.scope === 'all'
      ? [run(text, true)]
      : [
          run(text.slice(0, modelAnswer.scope.from), false),
          run(text.slice(modelAnswer.scope.from, modelAnswer.scope.to), true),
          run(text.slice(modelAnswer.scope.to), false),
        ].filter((node) => node.text !== '');

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        ...(modelAnswer.attrs ? { attrs: modelAnswer.attrs } : {}),
        content,
      },
      ...rest,
    ],
  };
}
