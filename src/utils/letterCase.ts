/**
 * Letter-case transformations, matching Word's Change Case menu.
 *
 * Deliberately environment-neutral — no `'use client'`. The ribbon calls it in
 * the browser and the marker calls it on the server to work out what a
 * "change to uppercase" question should have produced. Living in a client
 * module would make the server call throw at runtime.
 */

export type LetterCase = 'sentence' | 'lower' | 'upper' | 'capitalise' | 'toggle';

export const LETTER_CASES: { value: LetterCase; label: string }[] = [
  { value: 'sentence', label: 'Sentence case.' },
  { value: 'lower', label: 'lowercase' },
  { value: 'upper', label: 'UPPERCASE' },
  { value: 'capitalise', label: 'Capitalise Each Word' },
  { value: 'toggle', label: 'tOGGLE cASE' },
];

export function applyCase(text: string, mode: LetterCase): string {
  switch (mode) {
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    case 'capitalise':
      return text.replace(
        /\p{L}[\p{L}\p{M}']*/gu,
        (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      );
    case 'toggle':
      return [...text]
        .map((char) => (char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase()))
        .join('');
    case 'sentence':
      return text
        .toLowerCase()
        .replace(/(^\s*\p{L})|([.!?]\s+\p{L})/gu, (match) => match.toUpperCase());
    default:
      return text;
  }
}
