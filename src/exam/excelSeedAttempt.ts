import type { RangeAddress } from '@/spreadsheet/model/address';
import type { CellValue } from '@/spreadsheet/model/Cell';
import { blankSnapshot, type WorkbookSnapshot } from '@/spreadsheet/model/snapshot';
import type { CellStyle } from '@/spreadsheet/model/styles';
import type {
  Difficulty,
  ExamAttempt,
  ExcelQuestion,
  Language,
  Localised,
  WorkbookAnswer,
} from './types';

/**
 * The Excel practical paper.
 *
 * Transcribed from the supplied question paper, one question at a time. A
 * fixture, like `seedAttempt.ts`, held to the same rules:
 *
 * - **Every question owns its own workbook**, so switching questions cannot
 *   disturb another question's data.
 * - **The two languages differ only in their labels.** Numbers, layout and
 *   every cell address are identical, which is what keeps one answer key
 *   correct for both.
 * - **The answer key is not here.** This ships to the browser; what counts as
 *   correct lives in `src/server/marking/excelQuestionBank.ts`.
 *
 * Addresses in the comments are the A1 style the questions use; the code is
 * zero-based, so A1 is `{ row: 0, col: 0 }`.
 */

/* -- Building a starting sheet -------------------------------------------- */

type Row = readonly CellValue[];

/** A sheet from rows of values, with `null` for a cell left empty. */
function sheetOf(rows: readonly Row[]): WorkbookSnapshot {
  const snapshot = blankSnapshot();
  const sheet = snapshot.sheets[0]!;

  rows.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value === null || value === undefined) return;
      sheet.cells.push({ row: rowIndex, col: colIndex, value });
    });
  });

  return snapshot;
}

function range(startRow: number, startCol: number, endRow: number, endCol: number): RangeAddress {
  return { start: { row: startRow, col: startCol }, end: { row: endRow, col: endCol } };
}

/** A model answer that only applies formatting to one range. */
function formats(target: RangeAddress, style: Partial<CellStyle>): WorkbookAnswer {
  return { styles: [{ range: target, style }] };
}

function steps(en: string[], hi: string[]): Localised<string[]> {
  return { en, hi };
}

/* -- Shared data ---------------------------------------------------------- */

/** The five students most of the tables are built from. */
const STUDENTS: Array<[id: number, name: string, course: string, fee: number]> = [
  [101, 'Rahul', 'CCC', 5000],
  [102, 'Priya', 'DCA', 7000],
  [103, 'Amit', 'ADCA', 10000],
  [104, 'Neha', 'CCC', 5000],
  [105, 'Ravi', 'DCA', 7000],
];

const NAMES: Array<[id: number, first: string, last: string]> = [
  [101, 'Rahul', 'Sharma'],
  [102, 'Priya', 'Verma'],
  [103, 'Amit', 'Singh'],
  [104, 'Neha', 'Gupta'],
  [105, 'Ravi', 'Joshi'],
];

const FEES: Array<[student: string, total: number, paid: number]> = [
  ['Rahul', 5000, 3500],
  ['Priya', 8000, 6000],
  ['Amit', 5000, 5000],
  ['Neha', 7000, 4000],
  ['Ravi', 10000, 7500],
];

const MARKS: Array<[student: string, marks: number]> = [
  ['Rahul', 85],
  ['Priya', 92],
  ['Amit', 67],
  ['Neha', 78],
  ['Ravi', 88],
];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Values the answer key checks, derived here so the two cannot disagree. */
export const DUE_FEES = FEES.map(([, total, paid]) => total - paid);
export const FULL_NAMES = NAMES.map(([, first, last]) => `${first} ${last}`);
export const MIN_MARK = Math.min(...MARKS.map(([, mark]) => mark));
export const MAX_MARK = Math.max(...MARKS.map(([, mark]) => mark));

/** The ranges the questions name, so the paper and the key share one definition. */
export const TARGETS = {
  q1Title: range(0, 0, 0, 3),
  q2Title: range(0, 0, 0, 3),
  q3Header: range(1, 0, 1, 3),
  q4Table: range(0, 0, 5, 3),
  q5Fees: range(1, 3, 5, 3),
  q6Ids: range(1, 0, 5, 0),
  q7FullNames: range(1, 3, 5, 3),
  q8DueFees: range(1, 3, 5, 3),
  q9Months: range(2, 0, 12, 0),
  q10Minimum: { row: 7, col: 1 },
  q11Maximum: { row: 7, col: 1 },
  q12Across: range(0, 0, 1, 3),
  q13Heading: range(0, 0, 0, 4),
  q15PrintArea: range(0, 0, 4, 3),
} as const;

/** `STU1` in front of each id, which question 6 asks for. */
export const PREFIXED_IDS = STUDENTS.map(([id]) => `STU1${id}`);

/* -- The questions -------------------------------------------------------- */

interface Draft {
  topic: string;
  difficulty: Difficulty;
  instruction: Localised<string>;
  solution: Localised<string[]>;
  /** The sheet the candidate starts from. Labels differ by language. */
  sheet: (language: Language) => WorkbookSnapshot;
  modelAnswer: WorkbookAnswer;
  marks: number;
}

/** Column headings, per language. */
const HEAD: Localised<Record<string, string>> = {
  en: {
    studentId: 'Student ID', id: 'ID', name: 'Name', course: 'Course', fee: 'Fee',
    firstName: 'First Name', lastName: 'Last Name', fullName: 'Full Name',
    student: 'Student', totalFee: 'Total Fee', paidFee: 'Paid Fee', dueFee: 'Due Fee',
    marks: 'Marks', minimum: 'Minimum Value', maximum: 'Maximum Value',
    month: 'Month', value: 'Value', department: 'Department', salary: 'Salary', status: 'Status',
    enrollment: 'Student Enrollment Report', employees: 'Employee Details',
    sales: 'Sales Report', monthly: 'Monthly Sales',
    january: 'January', february: 'February', march: 'March', april: 'April',
  },
  hi: {
    studentId: 'छात्र आईडी', id: 'आईडी', name: 'नाम', course: 'कोर्स', fee: 'शुल्क',
    firstName: 'पहला नाम', lastName: 'उपनाम', fullName: 'पूरा नाम',
    student: 'छात्र', totalFee: 'कुल शुल्क', paidFee: 'जमा शुल्क', dueFee: 'शेष शुल्क',
    marks: 'अंक', minimum: 'न्यूनतम मान', maximum: 'अधिकतम मान',
    month: 'माह', value: 'मान', department: 'विभाग', salary: 'वेतन', status: 'स्थिति',
    enrollment: 'छात्र नामांकन रिपोर्ट', employees: 'कर्मचारी विवरण',
    sales: 'बिक्री रिपोर्ट', monthly: 'मासिक बिक्री',
    january: 'जनवरी', february: 'फ़रवरी', march: 'मार्च', april: 'अप्रैल',
  },
};

const DRAFTS: Draft[] = [
  {
    topic: 'Merge & Center',
    difficulty: 'Easy',
    instruction: {
      en: 'In the worksheet, merge and center the range A1:D1.',
      hi: 'Worksheet में A1:D1 को Merge & Center करें।',
    },
    solution: steps(
      ['Select the range A1:D1.', 'On the Home tab, in the Alignment group, click Merge & Center.'],
      ['A1:D1 श्रेणी चुनें।', 'Home टैब के Alignment समूह में Merge & Center पर क्लिक करें।'],
    ),
    sheet: (language) => sheetOf([[HEAD[language].enrollment!]]),
    modelAnswer: {
      merges: [TARGETS.q1Title],
      styles: [{ range: TARGETS.q1Title, style: { horizontalAlignment: 'center' } }],
    },
    marks: 3,
  },
  {
    topic: 'Font & Font Size',
    difficulty: 'Easy',
    instruction: {
      en: 'Apply Calibri, 20 pt, Bold formatting to A1:D1.',
      hi: 'A1:D1 पर Calibri, 20 pt और Bold लागू करें।',
    },
    solution: steps(
      [
        'Select the range A1:D1.',
        'On the Home tab, open the Font box and choose Calibri.',
        'Open the Font Size box and choose 20.',
        'Click Bold.',
      ],
      [
        'A1:D1 श्रेणी चुनें।',
        'Home टैब में Font बॉक्स खोलकर Calibri चुनें।',
        'Font Size बॉक्स खोलकर 20 चुनें।',
        'Bold पर क्लिक करें।',
      ],
    ),
    sheet: (language) => sheetOf([[HEAD[language].employees!]]),
    modelAnswer: formats(TARGETS.q2Title, { fontFamily: 'Calibri', fontSize: 20, bold: true }),
    marks: 3,
  },
  {
    topic: 'Text Colour & Cell Background',
    difficulty: 'Medium',
    instruction: {
      en: 'For A2:D2, set the text colour to Dark Blue, the cell background to Yellow, the font size to 19 pt, and apply Italic.',
      hi: 'A2:D2 में Text Color Dark Blue, Cell Background Yellow, Font Size 19 pt तथा Italic लागू करें।',
    },
    solution: steps(
      [
        'Select the range A2:D2.',
        'On the Home tab, click Font Color and choose Dark Blue.',
        'Click Fill Color and choose Yellow.',
        'Type 19 into the Font Size box.',
        'Click Italic.',
      ],
      [
        'A2:D2 श्रेणी चुनें।',
        'Home टैब में Font Color पर क्लिक कर Dark Blue चुनें।',
        'Fill Color पर क्लिक कर Yellow चुनें।',
        'Font Size बॉक्स में 19 लिखें।',
        'Italic पर क्लिक करें।',
      ],
    ),
    sheet: (language) =>
      sheetOf([
        [HEAD[language].employees!],
        [HEAD[language].name!, HEAD[language].department!, HEAD[language].salary!, HEAD[language].status!],
      ]),
    modelAnswer: formats(TARGETS.q3Header, {
      fontColor: '#002060',
      fillColor: '#ffff00',
      fontSize: 19,
      italic: true,
    }),
    marks: 3,
  },
  {
    topic: 'Outside Border',
    difficulty: 'Medium',
    instruction: {
      en: 'Apply an Outside Border to the range A1:D6.',
      hi: 'A1:D6 Range पर Outside Border लगाएँ।',
    },
    solution: steps(
      ['Select the range A1:D6.', 'On the Home tab, open Borders and choose Outside Borders.'],
      ['A1:D6 श्रेणी चुनें।', 'Home टैब में Borders खोलकर Outside Borders चुनें।'],
    ),
    sheet: (language) =>
      sheetOf([
        [HEAD[language].studentId!, HEAD[language].name!, HEAD[language].course!, HEAD[language].fee!],
        ...STUDENTS.map(([id, name, course, fee]) => [id, name, course, fee] as Row),
      ]),
    modelAnswer: {
      // The perimeter only: the key checks that the interior is left clear,
      // which is what separates this from All Borders.
      styles: [
        { range: range(0, 0, 0, 3), style: { borders: { top: { style: 'thin', color: '#000000' } } } },
        { range: range(5, 0, 5, 3), style: { borders: { bottom: { style: 'thin', color: '#000000' } } } },
        { range: range(0, 0, 5, 0), style: { borders: { left: { style: 'thin', color: '#000000' } } } },
        { range: range(0, 3, 5, 3), style: { borders: { right: { style: 'thin', color: '#000000' } } } },
      ],
    },
    marks: 3,
  },
  {
    topic: 'Currency Format & Background',
    difficulty: 'Medium',
    instruction: {
      en: 'Apply Currency with no decimal places to D2:D6, and set the cell background to Orange.',
      hi: 'D2:D6 को Currency (बिना Decimal) में Format करें तथा Cell Background Orange करें।',
    },
    solution: steps(
      [
        'Select the range D2:D6.',
        'On the Home tab, open the Number Format box and choose Currency (0 decimals).',
        'Click Fill Color and choose Orange.',
      ],
      [
        'D2:D6 श्रेणी चुनें।',
        'Home टैब में Number Format बॉक्स खोलकर Currency (0 decimals) चुनें।',
        'Fill Color पर क्लिक कर Orange चुनें।',
      ],
    ),
    sheet: (language) =>
      sheetOf([
        [HEAD[language].id!, HEAD[language].name!, HEAD[language].course!, HEAD[language].fee!],
        ...STUDENTS.map(([id, name, course, fee]) => [id, name, course, fee] as Row),
      ]),
    modelAnswer: formats(TARGETS.q5Fees, { numberFormat: '₹#,##0', fillColor: '#e36c0a' }),
    marks: 3,
  },
  {
    topic: 'Prefix',
    difficulty: 'Easy',
    instruction: {
      en: 'Add the prefix “STU1” before the values in A2:A6.',
      hi: 'A2:A6 के प्रत्येक Data के पहले “STU1” Prefix लगाएँ।',
    },
    solution: steps(
      [
        'Click cell A2 and type STU1101, then press Enter.',
        'Repeat down to A6, or type STU1101 and STU1102 and drag the fill handle down.',
      ],
      [
        'सेल A2 पर क्लिक कर STU1101 लिखें और Enter दबाएँ।',
        'A6 तक यही दोहराएँ, या STU1101 और STU1102 लिखकर Fill Handle नीचे खींचें।',
      ],
    ),
    sheet: (language) =>
      sheetOf([[HEAD[language].studentId!], ...STUDENTS.map(([id]) => [id] as Row)]),
    modelAnswer: {
      cells: PREFIXED_IDS.map((id, index) => ({ row: index + 1, col: 0, value: id })),
    },
    marks: 3,
  },
  {
    topic: 'CONCAT Formula',
    difficulty: 'Hard',
    instruction: {
      en: 'Use the CONCAT formula in D2:D6 to build the Full Name from the First Name and the Last Name.',
      hi: 'D2:D6 में CONCAT Formula का उपयोग करके First Name और Last Name से Full Name निकालें।',
    },
    solution: steps(
      [
        'Click cell D2.',
        'Type =CONCAT(B2," ",C2) and press Enter.',
        'Repeat for D3 to D6, or drag the fill handle down.',
      ],
      [
        'सेल D2 पर क्लिक करें।',
        '=CONCAT(B2," ",C2) लिखकर Enter दबाएँ।',
        'D3 से D6 तक दोहराएँ, या Fill Handle नीचे खींचें।',
      ],
    ),
    sheet: (language) =>
      sheetOf([
        [HEAD[language].id!, HEAD[language].firstName!, HEAD[language].lastName!, HEAD[language].fullName!],
        ...NAMES.map(([id, first, last]) => [id, first, last] as Row),
      ]),
    modelAnswer: {
      cells: FULL_NAMES.map((full, index) => ({
        row: index + 1,
        col: 3,
        value: full,
        formula: `=CONCAT(B${index + 2}," ",C${index + 2})`,
      })),
    },
    marks: 4,
  },
  {
    topic: 'Due Fee Formula',
    difficulty: 'Hard',
    instruction: {
      en: 'Calculate the Due Fee in D2:D6 with a formula: Total Fee − Paid Fee.',
      hi: 'D2:D6 में Formula का उपयोग करके Due Fee निकालें: Total Fee − Paid Fee।',
    },
    solution: steps(
      ['Click cell D2.', 'Type =B2-C2 and press Enter.', 'Repeat for D3 to D6, or drag the fill handle down.'],
      ['सेल D2 पर क्लिक करें।', '=B2-C2 लिखकर Enter दबाएँ।', 'D3 से D6 तक दोहराएँ, या Fill Handle नीचे खींचें।'],
    ),
    sheet: (language) =>
      sheetOf([
        [HEAD[language].student!, HEAD[language].totalFee!, HEAD[language].paidFee!, HEAD[language].dueFee!],
        ...FEES.map(([student, total, paid]) => [student, total, paid] as Row),
      ]),
    modelAnswer: {
      cells: DUE_FEES.map((due, index) => ({
        row: index + 1,
        col: 3,
        value: due,
        formula: `=B${index + 2}-C${index + 2}`,
      })),
    },
    marks: 4,
  },
  {
    topic: 'Auto Fill Month',
    difficulty: 'Medium',
    instruction: {
      en: 'Auto Fill the month names in A3:A13 so the column reads Jan, Feb, Mar … Dec.',
      hi: 'A3:A13 में Month Name को Auto Fill करें ताकि स्तंभ Jan, Feb, Mar … Dec पढ़े।',
    },
    solution: steps(
      [
        'Click cell A2, which already reads Jan.',
        'Drag the fill handle at its bottom-right corner down to A13.',
      ],
      [
        'सेल A2 पर क्लिक करें, जिसमें पहले से Jan लिखा है।',
        'उसके नीचे-दाएँ कोने के Fill Handle को A13 तक खींचें।',
      ],
    ),
    sheet: (language) => sheetOf([[HEAD[language].month!], ['Jan']]),
    modelAnswer: {
      cells: MONTHS.slice(1).map((month, index) => ({ row: index + 2, col: 0, value: month })),
    },
    marks: 4,
  },
  {
    topic: 'Minimum Value',
    difficulty: 'Medium',
    instruction: {
      en: 'Use a formula in B8 to find the minimum value in B2:B6.',
      hi: 'B8 में Formula का उपयोग करके B2:B6 का Minimum Value निकालें।',
    },
    solution: steps(
      ['Click cell B8.', 'Type =MIN(B2:B6) and press Enter.'],
      ['सेल B8 पर क्लिक करें।', '=MIN(B2:B6) लिखकर Enter दबाएँ।'],
    ),
    sheet: (language) =>
      sheetOf([
        [HEAD[language].student!, HEAD[language].marks!],
        ...MARKS.map(([student, mark]) => [student, mark] as Row),
        [],
        [HEAD[language].minimum!],
      ]),
    modelAnswer: {
      cells: [{ ...TARGETS.q10Minimum, value: MIN_MARK, formula: '=MIN(B2:B6)' }],
    },
    marks: 4,
  },
  {
    topic: 'Maximum Value',
    difficulty: 'Medium',
    instruction: {
      en: 'Use a formula in B8 to find the maximum value in B2:B6.',
      hi: 'B8 में Formula का उपयोग करके B2:B6 का Maximum Value निकालें।',
    },
    solution: steps(
      ['Click cell B8.', 'Type =MAX(B2:B6) and press Enter.'],
      ['सेल B8 पर क्लिक करें।', '=MAX(B2:B6) लिखकर Enter दबाएँ।'],
    ),
    sheet: (language) =>
      sheetOf([
        [HEAD[language].student!, HEAD[language].marks!],
        ...MARKS.map(([student, mark]) => [student, mark] as Row),
        [],
        [HEAD[language].maximum!],
      ]),
    modelAnswer: {
      cells: [{ ...TARGETS.q11Maximum, value: MAX_MARK, formula: '=MAX(B2:B6)' }],
    },
    marks: 4,
  },
  {
    topic: 'Merge Across',
    difficulty: 'Hard',
    instruction: {
      en: 'Apply Merge Across to the range A1:D2.',
      hi: 'A1:D2 Range पर Merge Across लागू करें।',
    },
    solution: steps(
      [
        'Select the range A1:D2.',
        'On the Home tab, in the Alignment group, click Merge Across.',
        'Merge Across merges each row on its own, so A1:D1 and A2:D2 become two merged cells — not one.',
      ],
      [
        'A1:D2 श्रेणी चुनें।',
        'Home टैब के Alignment समूह में Merge Across पर क्लिक करें।',
        'Merge Across हर पंक्ति को अलग-अलग मर्ज करता है, इसलिए A1:D1 और A2:D2 दो अलग merged cell बनते हैं।',
      ],
    ),
    sheet: (language) =>
      sheetOf([
        [HEAD[language].sales!],
        [HEAD[language].monthly!, HEAD[language].january!, HEAD[language].february!, HEAD[language].march!],
      ]),
    modelAnswer: {
      merges: [range(0, 0, 0, 3), range(1, 0, 1, 3)],
    },
    marks: 3,
  },
  {
    topic: 'Subscript Effect',
    difficulty: 'Hard',
    instruction: {
      en: 'For A1:E1, apply Merge & Center, apply the Subscript effect, and set the cell background to Yellow.',
      hi: 'A1:E1 को Merge & Center करें, Subscript Effect लगाएँ तथा Cell Background Yellow करें।',
    },
    solution: steps(
      [
        'Select the range A1:E1.',
        'On the Home tab, click Merge & Center.',
        'Click Subscript in the Font group.',
        'Click Fill Color and choose Yellow.',
      ],
      [
        'A1:E1 श्रेणी चुनें।',
        'Home टैब में Merge & Center पर क्लिक करें।',
        'Font समूह में Subscript पर क्लिक करें।',
        'Fill Color पर क्लिक कर Yellow चुनें।',
      ],
    ),
    sheet: (language) => sheetOf([[HEAD[language].employees!]]),
    modelAnswer: {
      merges: [TARGETS.q13Heading],
      styles: [
        {
          range: TARGETS.q13Heading,
          style: { horizontalAlignment: 'center', textEffect: 'subscript', fillColor: '#ffff00' },
        },
      ],
    },
    marks: 3,
  },
  {
    topic: 'Worksheet Heading',
    difficulty: 'Easy',
    instruction: {
      en: 'The row and column headings are hidden on this sheet. Show them.',
      hi: 'इस Sheet में Row व Column Heading छिपी हुई हैं। उन्हें Show करें।',
    },
    solution: steps(
      ['On the View tab, in the Show group, tick Headings.', 'Page Layout ▸ Sheet Options ▸ Headings: View does the same thing.'],
      ['View टैब के Show समूह में Headings चुनें।', 'Page Layout ▸ Sheet Options ▸ Headings: View से भी यही होता है।'],
    ),
    sheet: (language) => {
      const snapshot = sheetOf([
        [HEAD[language].sales!],
        [HEAD[language].january!, HEAD[language].february!, HEAD[language].march!, HEAD[language].april!],
        [25000, 30000, 28000, 35000],
      ]);
      snapshot.sheets[0]!.view = { showGridlines: true, showHeadings: false };
      return snapshot;
    },
    modelAnswer: { view: { showHeadings: true } },
    marks: 3,
  },
  {
    topic: 'Print Area',
    difficulty: 'Hard',
    instruction: {
      en: 'Set the print area to the Student Enrollment table in A1:D5, so the Month table in F1:G5 is left out of it.',
      hi: 'Print Area को A1:D5 की Student Enrollment तालिका पर सेट करें, ताकि F1:G5 की Month तालिका उसमें न आए।',
    },
    solution: steps(
      [
        'Select the range A1:D5.',
        'On the Page Layout tab, in the Page Setup group, click Set Print Area.',
        'A dashed outline appears around the print area.',
      ],
      [
        'A1:D5 श्रेणी चुनें।',
        'Page Layout टैब के Page Setup समूह में Set Print Area पर क्लिक करें।',
        'Print Area के चारों ओर एक बिंदुदार रेखा दिखाई देगी।',
      ],
    ),
    sheet: (language) =>
      sheetOf([
        [
          HEAD[language].studentId!, HEAD[language].name!, HEAD[language].course!, HEAD[language].fee!,
          null, HEAD[language].month!, HEAD[language].value!,
        ],
        ...STUDENTS.slice(0, 4).map(([id, name, course, fee], index) => [
          `STU${id}`, name, course, fee, null, MONTHS[index]!, [5000, 7000, 10000, 5000][index]!,
        ] as Row),
      ]),
    modelAnswer: { printArea: TARGETS.q15PrintArea },
    marks: 3,
  },
];

function buildQuestions(): ExcelQuestion[] {
  return DRAFTS.map((draft, index) => ({
    subject: 'excel' as const,
    number: index + 1,
    topic: draft.topic,
    difficulty: draft.difficulty,
    instruction: draft.instruction,
    // A fresh sheet per question and per language: each owns its workbook, so
    // work on one cannot leak into another.
    workbook: { en: draft.sheet('en'), hi: draft.sheet('hi') },
    solution: draft.solution,
    modelAnswer: draft.modelAnswer,
    marks: draft.marks,
    bookmarked: false,
  }));
}

export const EXCEL_SEED_ATTEMPT: ExamAttempt = {
  // Replaced with the signed-in user's real name at the start of a sitting.
  candidateName: 'Candidate',
  subject: 'excel',
  durationSeconds: 15 * 60,
  sections: [{ name: 'Spreadsheet', questions: buildQuestions() }],
};

/** The workbook a question starts from, for the editor to install. */
export function startingWorkbook(question: ExcelQuestion, language: Language): WorkbookSnapshot {
  return question.workbook[language];
}
