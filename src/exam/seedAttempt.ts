import type { ExamAttempt, ExamQuestion } from './types';

/**
 * Demo data.
 *
 * There is no exam backend in this build, so the panels are seeded with a fixed
 * paper. It is a fixture, not a fallback: `useExamStore.setAttempt` replaces it
 * wholesale once a real source exists, and nothing else in the UI reads from
 * here.
 *
 * No answer state lives here. Whether a question has been attempted is derived
 * from what the candidate has typed; see `statusOf`.
 */

const PROMPTS = [
  'A train 240 m long crosses a platform in 20 seconds. Find the length of the platform.',
  'The average of five consecutive even numbers is 42. What is the largest of them?',
  'A sum of money doubles itself in 8 years at simple interest. Find the rate.',
  'Two pipes fill a tank in 12 and 18 minutes respectively. How long together?',
  'The ratio of the ages of A and B is 4 : 5. In 6 years it will be 6 : 7. Find their ages.',
  'A shopkeeper marks his goods 40% above cost price and allows a 10% discount.',
  'Find the compound interest on Rs. 12,000 for 2 years at 10% per annum.',
  'The perimeter of a rectangle is 84 cm and its length is twice its breadth.',
  'A boat travels 24 km upstream in 6 hours and returns in 3 hours. Find the speed.',
  'If 15 workers can complete a job in 24 days, how long will 20 workers take?',
  'The mean of 20 observations was found to be 45, but one was misread as 25 for 52.',
  'A number when divided by 91 leaves a remainder of 17. Find the remainder by 13.',
  'Two cards are drawn from a deck. What is the probability that both are red?',
  'Simplify: (0.75 × 0.75 + 0.25 × 0.25 + 2 × 0.75 × 0.25).',
  'A man sells two articles at Rs. 990 each, gaining 10% on one and losing 10% on the other.',
];

/** Flagged for review in the seed data, to show the marker in the palette. */
const BOOKMARKED = new Set([12, 14]);

function buildQuestions(): ExamQuestion[] {
  return PROMPTS.map((prompt, index) => ({
    number: index + 1,
    bookmarked: BOOKMARKED.has(index + 1),
    prompt,
  }));
}

export const SEED_ATTEMPT: ExamAttempt = {
  candidateName: 'Praveen',
  durationSeconds: 10 * 60,
  sections: [{ name: 'Quantitative Aptitude', questions: buildQuestions() }],
};
