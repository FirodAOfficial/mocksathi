/**
 * The functions Formula AutoComplete offers.
 *
 * Only functions the calculation engine can actually evaluate are listed:
 * offering MATCH or SUMIFS here, which `fast-formula-parser` does not
 * implement, would hand a candidate a formula that turns into `#NAME?` the
 * moment they commit it. `functionCatalog.test.ts` holds this list to the
 * engine's own `supportedFunctions()` plus `SUPPLEMENTARY_FUNCTIONS`, so adding
 * a function to the engine without listing it here — or the reverse — fails.
 *
 * Static rather than read from the engine, because the engine is loaded lazily
 * and the list has to be there the moment `=` is typed.
 */

export interface FunctionInfo {
  name: string;
  /** Excel's ScreenTip: what the function does, in one line. */
  description?: string;
}

/** Descriptions for the functions an exam is likely to ask for. */
const DESCRIBED: Record<string, string> = {
  ABS: 'Returns the absolute value of a number.',
  AND: 'Checks whether all arguments are TRUE.',
  AVERAGE: 'Returns the average (arithmetic mean) of its arguments.',
  AVERAGEA: 'Returns the average of its arguments, counting text as 0.',
  AVERAGEIF: 'Averages the cells that meet a given condition.',
  CEILING: 'Rounds a number up to the nearest multiple of significance.',
  CHAR: 'Returns the character specified by a code number.',
  CLEAN: 'Removes all nonprintable characters from text.',
  CODE: 'Returns a numeric code for the first character in a text string.',
  COLUMN: 'Returns the column number of a reference.',
  COLUMNS: 'Returns the number of columns in a reference.',
  CONCAT: 'Joins a list or range of text strings.',
  CONCATENATE: 'Joins several text strings into one.',
  COUNT: 'Counts the number of cells in a range that contain numbers.',
  COUNTA: 'Counts the number of cells in a range that are not empty.',
  COUNTIF: 'Counts the cells in a range that meet a given condition.',
  DATE: 'Returns the number that represents a date.',
  DATEDIF: 'Calculates the days, months or years between two dates.',
  DATEVALUE: 'Converts a date in text form to a serial number.',
  DAY: 'Returns the day of the month, a number from 1 to 31.',
  DAYS: 'Returns the number of days between two dates.',
  DOLLAR: 'Converts a number to text, using currency format.',
  EDATE: 'Returns the date that is a number of months before or after a date.',
  EOMONTH: 'Returns the last day of the month a number of months away.',
  EVEN: 'Rounds a number up to the nearest even integer.',
  EXACT: 'Checks whether two text strings are exactly the same.',
  EXP: 'Returns e raised to the power of a given number.',
  FACT: 'Returns the factorial of a number.',
  FALSE: 'Returns the logical value FALSE.',
  FIND: 'Returns the position of one text string within another (case-sensitive).',
  FIXED: 'Rounds a number and returns it as text.',
  FLOOR: 'Rounds a number down to the nearest multiple of significance.',
  HLOOKUP: 'Looks for a value in the top row of a table and returns a value from a row below.',
  HOUR: 'Returns the hour, a number from 0 to 23.',
  IF: 'Returns one value if a condition is TRUE and another if it is FALSE.',
  IFERROR: 'Returns a value you specify if a formula evaluates to an error.',
  IFNA: 'Returns a value you specify if the expression resolves to #N/A.',
  IFS: 'Checks conditions in turn and returns the value for the first TRUE one.',
  INDEX: 'Returns a value from a given row and column of a range.',
  INT: 'Rounds a number down to the nearest integer.',
  ISBLANK: 'Checks whether a reference is to an empty cell.',
  ISERROR: 'Checks whether a value is an error.',
  ISEVEN: 'Returns TRUE if the number is even.',
  ISNUMBER: 'Checks whether a value is a number.',
  ISTEXT: 'Checks whether a value is text.',
  LEFT: 'Returns the specified number of characters from the start of a text string.',
  LEN: 'Returns the number of characters in a text string.',
  LN: 'Returns the natural logarithm of a number.',
  LOG: 'Returns the logarithm of a number to the base you specify.',
  LOG10: 'Returns the base-10 logarithm of a number.',
  LOWER: 'Converts all letters in a text string to lowercase.',
  MAX: 'Returns the largest value in a set of values.',
  MEDIAN: 'Returns the median of the given numbers.',
  MID: 'Returns characters from the middle of a text string.',
  MIN: 'Returns the smallest value in a set of values.',
  MINUTE: 'Returns the minute, a number from 0 to 59.',
  MOD: 'Returns the remainder after a number is divided by a divisor.',
  MONTH: 'Returns the month, a number from 1 (January) to 12 (December).',
  MROUND: 'Returns a number rounded to the desired multiple.',
  NETWORKDAYS: 'Returns the number of whole workdays between two dates.',
  NOT: 'Changes FALSE to TRUE, or TRUE to FALSE.',
  NOW: 'Returns the current date and time.',
  ODD: 'Rounds a number up to the nearest odd integer.',
  OR: 'Checks whether any of the arguments are TRUE.',
  PI: 'Returns the value of pi, 3.14159265358979.',
  POWER: 'Returns the result of a number raised to a power.',
  PRODUCT: 'Multiplies all the numbers given as arguments.',
  PROPER: 'Capitalises the first letter of each word in a text string.',
  QUOTIENT: 'Returns the integer portion of a division.',
  RAND: 'Returns a random number between 0 and 1.',
  RANDBETWEEN: 'Returns a random number between the numbers you specify.',
  REPLACE: 'Replaces part of a text string with a different text string.',
  REPT: 'Repeats text a given number of times.',
  RIGHT: 'Returns the specified number of characters from the end of a text string.',
  ROMAN: 'Converts an Arabic numeral to Roman, as text.',
  ROUND: 'Rounds a number to a specified number of digits.',
  ROUNDDOWN: 'Rounds a number down, toward zero.',
  ROUNDUP: 'Rounds a number up, away from zero.',
  ROW: 'Returns the row number of a reference.',
  ROWS: 'Returns the number of rows in a reference.',
  SEARCH: 'Returns the position of one text string within another (not case-sensitive).',
  SECOND: 'Returns the second, a number from 0 to 59.',
  SIGN: 'Returns the sign of a number: 1, 0 or -1.',
  SQRT: 'Returns the square root of a number.',
  SUM: 'Adds all the numbers in a range of cells.',
  SUMIF: 'Adds the cells specified by a given condition.',
  SUMPRODUCT: 'Returns the sum of the products of corresponding ranges.',
  SUMSQ: 'Returns the sum of the squares of the arguments.',
  T: 'Returns the text referred to by a value.',
  TEXT: 'Formats a number and converts it to text.',
  TIME: 'Returns the number that represents a time.',
  TODAY: "Returns today's date.",
  TRIM: 'Removes extra spaces from text.',
  TRUE: 'Returns the logical value TRUE.',
  TRUNC: 'Truncates a number to an integer.',
  UPPER: 'Converts text to uppercase.',
  VLOOKUP: 'Looks for a value in the first column of a table and returns a value from a column to the right.',
  WEEKDAY: 'Returns a number from 1 to 7 identifying the day of the week.',
  WEEKNUM: 'Returns the week number in the year.',
  WORKDAY: 'Returns the date a number of workdays before or after a date.',
  XOR: 'Returns a logical Exclusive Or of all arguments.',
  YEAR: 'Returns the year of a date.',
  YEARFRAC: 'Returns the year fraction representing the days between two dates.',
};

/** Every function the engine evaluates, alphabetically. */
const NAMES = [
  'ABS', 'ACOS', 'ACOSH', 'ACOT', 'ACOTH', 'ADDRESS', 'AND', 'ARABIC', 'AREAS', 'ASC', 'ASIN',
  'ASINH', 'ATAN', 'ATAN2', 'ATANH', 'AVEDEV', 'AVERAGE', 'AVERAGEA', 'AVERAGEIF', 'BAHTTEXT',
  'BASE', 'BESSELI', 'BESSELJ', 'BESSELK', 'BESSELY', 'BETA.DIST', 'BETA.INV', 'BIN2DEC',
  'BIN2HEX', 'BIN2OCT', 'BINOM.DIST', 'BINOM.DIST.RANGE', 'BINOM.INV', 'BITAND', 'BITLSHIFT',
  'BITOR', 'BITRSHIFT', 'BITXOR', 'CEILING', 'CEILING.MATH', 'CEILING.PRECISE', 'CHAR',
  'CHISQ.DIST', 'CHISQ.DIST.RT', 'CHISQ.INV', 'CHISQ.INV.RT', 'CHISQ.TEST', 'CLEAN', 'CODE',
  'COLUMN', 'COLUMNS', 'COMBIN', 'COMBINA', 'COMPLEX', 'CONCAT', 'CONCATENATE', 'CONFIDENCE.NORM',
  'CONFIDENCE.T', 'CORREL', 'COS', 'COSH', 'COT', 'COTH', 'COUNT', 'COUNTA', 'COUNTIF',
  'COVARIANCE.P', 'COVARIANCE.S', 'CSC', 'CSCH', 'DATE', 'DATEDIF', 'DATEVALUE', 'DAY', 'DAYS',
  'DAYS360', 'DBCS', 'DEC2BIN', 'DEC2HEX', 'DEC2OCT', 'DECIMAL', 'DEGREES', 'DELTA', 'DEVSQ',
  'DOLLAR', 'EDATE', 'ENCODEURL', 'EOMONTH', 'ERF', 'ERFC', 'ERROR.TYPE', 'EVEN', 'EXACT', 'EXP',
  'EXPON.DIST', 'F.DIST', 'F.DIST.RT', 'F.INV', 'F.INV.RT', 'F.TEST', 'FACT', 'FACTDOUBLE',
  'FALSE', 'FIND', 'FINDB', 'FISHER', 'FISHERINV', 'FIXED', 'FLOOR', 'FLOOR.MATH',
  'FLOOR.PRECISE', 'FORECAST', 'FORECAST.LINEAR', 'FREQUENCY', 'GAMMA', 'GAMMA.DIST', 'GAMMA.INV',
  'GAMMALN', 'GAMMALN.PRECISE', 'GAUSS', 'GCD', 'GEOMEAN', 'GESTEP', 'GROWTH', 'HARMEAN',
  'HEX2BIN', 'HEX2DEC', 'HEX2OCT', 'HLOOKUP', 'HOUR', 'HYPGEOM.DIST', 'IF', 'IFERROR', 'IFNA',
  'IFS', 'IMABS', 'IMAGINARY', 'IMARGUMENT', 'IMCONJUGATE', 'IMCOS', 'IMCOSH', 'IMCOT', 'IMCSC',
  'IMCSCH', 'IMDIV', 'IMEXP', 'IMLN', 'IMLOG10', 'IMLOG2', 'IMPOWER', 'IMPRODUCT', 'IMREAL',
  'IMSEC', 'IMSECH', 'IMSIN', 'IMSINH', 'IMSQRT', 'IMSUB', 'IMSUM', 'IMTAN', 'INDEX', 'INT',
  'INTERCEPT', 'ISBLANK', 'ISERR', 'ISERROR', 'ISEVEN', 'ISLOGICAL', 'ISNA', 'ISNONTEXT',
  'ISNUMBER', 'ISO.CEILING', 'ISOWEEKNUM', 'ISREF', 'ISTEXT', 'KURT', 'LCM', 'LEFT', 'LEFTB',
  'LEN', 'LENB', 'LN', 'LOG', 'LOG10', 'LOGNORM.DIST', 'LOGNORM.INV', 'LOWER', 'MAX', 'MDETERM', 'MEDIAN',
  'MID', 'MIDB', 'MIN', 'MINUTE', 'MMULT', 'MOD', 'MONTH', 'MROUND', 'MULTINOMIAL', 'MUNIT', 'N',
  'NA', 'NEGBINOM.DIST', 'NETWORKDAYS', 'NETWORKDAYS.INTL', 'NORM.DIST', 'NORM.INV', 'NORM.S.DIST',
  'NORM.S.INV', 'NOT', 'NOW', 'NUMBERVALUE', 'OCT2BIN', 'OCT2DEC', 'OCT2HEX', 'ODD', 'OR', 'PHI',
  'PI', 'POISSON.DIST', 'POWER', 'PRODUCT', 'PROPER', 'QUOTIENT', 'RADIANS', 'RAND',
  'RANDBETWEEN', 'REPLACE', 'REPLACEB', 'REPT', 'RIGHT', 'RIGHTB', 'ROMAN', 'ROUND', 'ROUNDDOWN',
  'ROUNDUP', 'ROW', 'ROWS', 'SEARCH', 'SEARCHB', 'SEC', 'SECH', 'SECOND', 'SERIESSUM', 'SIGN',
  'SIN', 'SINH', 'SQRT', 'SQRTPI', 'STANDARDIZE', 'SUM', 'SUMIF', 'SUMPRODUCT', 'SUMSQ',
  'SUMX2MY2', 'SUMX2PY2', 'SUMXMY2', 'T', 'T.DIST', 'T.DIST.2T', 'T.DIST.RT', 'T.INV', 'T.INV.2T',
  'TAN', 'TANH', 'TEXT', 'TIME', 'TIMEVALUE', 'TODAY', 'TRANSPOSE', 'TRIM', 'TRUE', 'TRUNC',
  'TYPE', 'UNICHAR', 'UNICODE', 'UPPER', 'VLOOKUP', 'WEEKDAY', 'WEEKNUM', 'WEIBULL.DIST',
  'WORKDAY', 'WORKDAY.INTL', 'XOR', 'YEAR', 'YEARFRAC',
];

export const FUNCTION_CATALOG: readonly FunctionInfo[] = NAMES.map((name) => ({
  name,
  description: DESCRIBED[name],
}));

/** The functions whose names start with `prefix`, in alphabetical order. */
export function functionsStartingWith(prefix: string): readonly FunctionInfo[] {
  const wanted = prefix.toUpperCase();
  return wanted === ''
    ? FUNCTION_CATALOG
    : FUNCTION_CATALOG.filter((entry) => entry.name.startsWith(wanted));
}

/** The span of a formula AutoComplete would replace, and what has been typed of it. */
export interface CompletionSlot {
  start: number;
  end: number;
  prefix: string;
}

/**
 * Characters after which a formula expects an operand — and so where a
 * function name may begin. Kept in step with `AWAITING_OPERAND` in CellEditor.
 */
const OPERAND_START = new Set(['=', '+', '-', '*', '/', '^', '(', ',', ';', '&', '<', '>']);

/**
 * Where Formula AutoComplete applies, given the text and the caret.
 *
 * - Right after the leading `=` the whole list is offered, so a candidate can
 *   browse every function before typing a letter.
 * - Otherwise only while a name is being typed where an operand belongs:
 *   `=SU`, `=A1+RO`, `=IF(LE`. A name inside a string literal is not a call.
 */
export function completionSlot(text: string, caret: number): CompletionSlot | null {
  if (!text.startsWith('=')) return null;

  const head = text.slice(0, caret);
  if (head === '=') return { start: 1, end: 1, prefix: '' };

  // An odd number of quotes means the caret is inside "a string".
  if ((head.match(/"/g)?.length ?? 0) % 2 === 1) return null;

  const match = /[A-Za-z][A-Za-z0-9.]*$/.exec(head);
  if (!match) return null;

  const before = head.slice(0, match.index).trimEnd();
  if (!OPERAND_START.has(before[before.length - 1] ?? '')) return null;

  // The whole word under the caret is replaced, not just the half before it.
  const rest = /^[A-Za-z0-9.]*/.exec(text.slice(caret))?.[0] ?? '';
  return { start: match.index, end: caret + rest.length, prefix: match[0] };
}
