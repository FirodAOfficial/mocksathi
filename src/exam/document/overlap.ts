import type { DocumentStep } from './types';

/**
 * Questions that touch the same formatting on the same text.
 *
 * A candidate answers in any order, and each question is marked only on what
 * changed while it was open. Two questions that set the same property on the
 * same characters cannot both show a change in every order: whichever is
 * answered second finds the work already done. "Bold the paragraph" after
 * "bold its first word" survives that — the paragraph still changes — but
 * "make it red" and "make it blue" on the same word do not, and "bold the
 * word" after "bold the paragraph" leaves nothing to do.
 *
 * Detection cannot tell those apart from intent, so this warns rather than
 * refuses, and says which question it collides with.
 */

interface Footprint {
  property: string;
  block: number;
  from: number;
  to: number;
}

function footprints(steps: readonly DocumentStep[]): Footprint[] {
  return steps
    .filter((step) => !step.licenceOnly)
    .flatMap((step): Footprint[] =>
      step.level === 'character'
        ? step.changes.map((change) => ({ property: change.property, block: step.block, ...change.range }))
        : step.blocks.flatMap((block) =>
            // A paragraph change covers the whole block.
            step.changes.map((change) => ({ property: `paragraph:${change.property}`, block, from: 0, to: Infinity })),
          ),
    );
}

function overlaps(a: Footprint, b: Footprint): boolean {
  return a.property === b.property && a.block === b.block && a.from < b.to && b.from < a.to;
}

/** One warning per earlier question this one collides with. */
export function overlapWarnings(
  steps: readonly DocumentStep[],
  others: readonly { number: number; steps: readonly DocumentStep[] }[],
): string[] {
  const mine = footprints(steps);
  const warnings: string[] = [];

  for (const other of others) {
    const theirs = footprints(other.steps);
    const clash = mine.find((footprint) => theirs.some((their) => overlaps(footprint, their)));
    if (!clash) continue;

    const what = clash.property.replace(/^paragraph:/, '');
    warnings.push(
      `Changes the same ${what} on the same text as question ${other.number}. A candidate who answers question ${other.number} after this one may find nothing left to change — consider a different selection.`,
    );
  }

  return warnings;
}
