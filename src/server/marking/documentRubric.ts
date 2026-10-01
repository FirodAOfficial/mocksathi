import 'server-only';

import { acceptedColours } from '@/editor/functions/colours';
import {
  describeBlock,
  describeCharacterChange,
  describeParagraphChange,
  describeRange,
} from '@/exam/document/describe';
import type { CharacterChange, DocumentStep } from '@/exam/document/types';
import type { Criterion, Exemption, QuestionRubric, Target } from '@/exam/marking/criteria';
import type { FlatDocument, MarkName } from '@/exam/marking/flatten';
import type { ParagraphFormatting } from '@/services/document/types';

/**
 * The answer key for a single-document question, built from what was detected.
 *
 * `server-only` for the same reason as `rubricFromOperations.ts`: this is the
 * marking scheme, and an accidental client import must fail the build.
 *
 * A question in this flow is not "the document must look like this" — the
 * candidate's document carries every other question they have answered too, in
 * whatever order they chose. It is "while this question was open, exactly this
 * changed". So the criteria come in two halves, checked by `documentMarker`
 * against the candidate's own before and after for this question:
 *
 * - each detected change, as a statement about the *after*: "the 3rd word of
 *   paragraph 2 is bold";
 * - one `unchanged`, comparing after against before with each change licensed,
 *   so that also italicising it — or bolding the wrong word as well — fails.
 *
 * Neither half mentions any other question, which is what makes the order the
 * candidate works in irrelevant.
 */

const NOTHING_ELSE = 'Nothing else in the document was changed while this question was open';

/** The marker's name for a property, given which way it changed. */
function markFor(change: Pick<CharacterChange, 'property' | 'value' | 'previous'>): MarkName | null {
  const value = change.value ?? change.previous;
  switch (change.property) {
    case 'vertAlign':
      return value === 'sub' ? 'subscript' : value === 'super' ? 'superscript' : null;
    case 'effect':
      return value === 'engrave' ? 'engrave' : value === 'emboss' ? 'emboss' : null;
    default:
      return change.property as MarkName;
  }
}

/** Every mark name stored in a property's slot, so licensing one licenses the slot. */
function licensedMarks(property: CharacterChange['property']): MarkName[] {
  if (property === 'vertAlign') return ['superscript', 'subscript'];
  if (property === 'effect') return ['emboss', 'engrave'];
  return [property as MarkName];
}

const COLOURED = new Set(['color', 'highlight', 'underlineColor']);
const VALUED = new Set(['underlineStyle', 'caps', 'fontFamily', 'fontSize', 'charScale', 'charSpacing']);

function characterCriterion(change: CharacterChange, target: Target, label: string): Criterion | null {
  const mark = markFor(change);
  if (!mark) return null;

  if (change.value === null || change.value === false) return { kind: 'notMarked', label, target, mark };

  if (COLOURED.has(change.property)) {
    // Either of Office's two reds, as the authored papers allow.
    return { kind: 'marked', label, target, mark, value: acceptedColours(String(change.value)) };
  }
  if (VALUED.has(change.property)) {
    return { kind: 'marked', label, target, mark, value: change.value as string | number };
  }
  return { kind: 'marked', label, target, mark };
}

/**
 * The key for one question.
 *
 * `document` is the paper's passage, used only to word the labels ("the 3rd
 * word of paragraph 2"); nothing is checked against it.
 */
export function documentRubricFor(
  number: number,
  steps: readonly DocumentStep[],
  document: FlatDocument | null,
): QuestionRubric {
  const criteria: Criterion[] = [];
  const exemptions: Exemption[] = [];

  for (const step of steps) {
    if (step.level === 'character') {
      const target: Target = { by: 'range', block: step.block, from: step.from, to: step.to };
      const where = describeRange(document, step);

      for (const change of step.changes) {
        exemptions.push({
          target: { by: 'range', block: step.block, from: change.licence.from, to: change.licence.to },
          marks: licensedMarks(change.property),
        });
        if (step.licenceOnly) continue;

        const criterion = characterCriterion(change, target, `${describeCharacterChange(change)} — ${where}`);
        if (criterion) criteria.push(criterion);
      }
      continue;
    }

    const attributes = step.changes
      .map((change) => change.property)
      .filter((property): property is keyof ParagraphFormatting => property !== 'styleId' && property !== 'list');
    const style = step.changes.some((change) => change.property === 'styleId');
    const list = step.changes.some((change) => change.property === 'list');

    for (const block of step.blocks) {
      exemptions.push({
        target: { by: 'block', block },
        ...(attributes.length > 0 ? { paragraph: attributes } : {}),
        ...(style ? { style: true } : {}),
        ...(list ? { list: true } : {}),
      });
      if (step.licenceOnly) continue;

      const where = describeBlock(document, block);
      for (const change of step.changes) {
        const label = `${describeParagraphChange(change)} — ${where}`;
        if (change.property === 'styleId') {
          criteria.push({ kind: 'blockStyle', label, block, styleId: change.value as never });
        } else if (change.property === 'list') {
          criteria.push({
            kind: 'listKind',
            label,
            block,
            listKind: change.value === 'bullet' || change.value === 'ordered' ? change.value : null,
          });
        } else {
          criteria.push({ kind: 'blockAttr', label, block, attr: change.property, value: change.value ?? null });
        }
      }
    }
  }

  criteria.push({ kind: 'unchanged', label: NOTHING_ELSE, except: exemptions });
  return { number, criteria };
}
