'use client';

import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { FormatState } from '@/editor/useFormatState';
import {
  setAlignment,
  setContextualSpacing,
  setIndents,
  setLineSpacing,
  setLineSpacingAt,
  setParagraphSpacing,
} from '@/editor/ribbonActions';
import type { TextAlignment } from '@/services/document/types';
import { cmToPx, pointsToPx, pxToCm, pxToPoints } from '@/utils/units';
import { Dialog } from './Dialog';
import styles from './FontDialog.module.css';

export interface ParagraphDialogProps {
  editor: Editor;
  /** The paragraph's current formatting, so the boxes open on what is there. */
  format: FormatState;
  onClose: () => void;
}

type Special = 'none' | 'firstLine' | 'hanging';
type Spacing = 'multiple' | 'atLeast' | 'exactly';

/**
 * Word's Paragraph dialog, from the Paragraph group's launcher arrow.
 *
 * Indents in centimetres and spacing in points, as Word's boxes are labelled;
 * the model stores CSS pixels, and `@/utils/units` converts at this boundary so
 * a question asking for "1.1 inches" and a candidate typing it end up at the
 * same number.
 *
 * Two of Word's controls are deliberately absent rather than shown inert:
 * Mirror indents and Outline level have no representation in the document model
 * this app marks against, and a control that records nothing would read as one
 * that does.
 */
export function ParagraphDialog({ editor, format, onClose }: ParagraphDialogProps) {
  const [align, setAlign] = useState<TextAlignment>(format.align);

  const [left, setLeft] = useState<number>(pxToCm(format.indentLeft ?? 0));
  const [right, setRight] = useState<number>(pxToCm(format.indentRight ?? 0));

  const first = format.indentFirstLine ?? 0;
  const [special, setSpecial] = useState<Special>(first > 0 ? 'firstLine' : first < 0 ? 'hanging' : 'none');
  const [specialBy, setSpecialBy] = useState<number>(Math.abs(pxToCm(first)) || 1.27);

  const [before, setBefore] = useState<number>(pxToPoints(format.spaceBefore ?? 0));
  const [after, setAfter] = useState<number>(pxToPoints(format.spaceAfter ?? 0));

  const [spacing, setSpacing] = useState<Spacing>(
    format.lineSpacingMode === 'atLeast' || format.lineSpacingMode === 'exactly'
      ? format.lineSpacingMode
      : 'multiple',
  );
  const [spacingAt, setSpacingAt] = useState<number>(
    format.lineSpacingMode === 'atLeast' || format.lineSpacingMode === 'exactly'
      ? (format.lineSpacingPt ?? 12)
      : (format.lineHeight ?? 1.08),
  );

  const [noSpaceSameStyle, setNoSpaceSameStyle] = useState(format.contextualSpacing);

  const apply = (): void => {
    setAlignment(editor, align);

    setIndents(editor, {
      left: left === 0 ? null : cmToPx(left),
      right: right === 0 ? null : cmToPx(right),
      firstLine:
        special === 'none' ? null : special === 'hanging' ? -cmToPx(specialBy) : cmToPx(specialBy),
    });

    setParagraphSpacing(editor, {
      before: before === 0 ? null : pointsToPx(before),
      after: after === 0 ? null : pointsToPx(after),
    });

    // The two line-spacing shapes are exclusive: a multiplier clears the
    // measurement and vice versa, which is what the editor command does too.
    if (spacing === 'multiple') {
      setLineSpacingAt(editor, null, 0);
      setLineSpacing(editor, spacingAt);
    } else {
      setLineSpacingAt(editor, spacing, spacingAt);
    }

    setContextualSpacing(editor, noSpaceSameStyle);
    onClose();
  };

  return (
    <Dialog
      title="Paragraph"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.button} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={apply}>
            OK
          </button>
        </>
      }
    >
      <fieldset className={styles.group}>
        <legend className={styles.legend}>General</legend>
        <label className={styles.stack}>
          <span className={styles.caption}>Alignment:</span>
          <select
            className={styles.input}
            value={align}
            onChange={(event) => setAlign(event.target.value as TextAlignment)}
          >
            <option value="left">Left</option>
            <option value="center">Centred</option>
            <option value="right">Right</option>
            <option value="justify">Justified</option>
          </select>
        </label>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Indentation</legend>

        <div className={styles.row}>
          <label className={styles.stack}>
            <span className={styles.caption}>Left:</span>
            <Measure value={left} onChange={setLeft} min={0} max={20} step={0.25} unit="cm" />
          </label>

          <label className={styles.stack}>
            <span className={styles.caption}>Right:</span>
            <Measure value={right} onChange={setRight} min={0} max={20} step={0.25} unit="cm" />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.stack}>
            <span className={styles.caption}>Special:</span>
            <select
              className={styles.input}
              value={special}
              onChange={(event) => setSpecial(event.target.value as Special)}
            >
              <option value="none">(none)</option>
              <option value="firstLine">First line</option>
              <option value="hanging">Hanging</option>
            </select>
          </label>

          <label className={styles.stack}>
            <span className={styles.caption}>By:</span>
            <Measure
              value={specialBy}
              onChange={setSpecialBy}
              min={0}
              max={20}
              step={0.25}
              unit="cm"
              disabled={special === 'none'}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Spacing</legend>

        <div className={styles.row}>
          <label className={styles.stack}>
            <span className={styles.caption}>Before:</span>
            <Measure value={before} onChange={setBefore} min={0} max={1584} step={1} unit="pt" />
          </label>

          <label className={styles.stack}>
            <span className={styles.caption}>After:</span>
            <Measure value={after} onChange={setAfter} min={0} max={1584} step={1} unit="pt" />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.stack}>
            <span className={styles.caption}>Line spacing:</span>
            <select
              className={styles.input}
              value={spacing}
              onChange={(event) => {
                const next = event.target.value as Spacing;
                setSpacing(next);
                // The box means different things either side of this switch —
                // a multiplier or a measurement — so it starts from a value
                // that makes sense in the mode just chosen.
                setSpacingAt(next === 'multiple' ? 1.15 : 12);
              }}
            >
              <option value="multiple">Multiple</option>
              <option value="atLeast">At least</option>
              <option value="exactly">Exactly</option>
            </select>
          </label>

          <label className={styles.stack}>
            <span className={styles.caption}>At:</span>
            <Measure
              value={spacingAt}
              onChange={setSpacingAt}
              min={spacing === 'multiple' ? 0.5 : 1}
              max={spacing === 'multiple' ? 10 : 1584}
              step={spacing === 'multiple' ? 0.01 : 0.5}
              unit={spacing === 'multiple' ? '' : 'pt'}
            />
          </label>
        </div>

        <label className={styles.choice}>
          <input
            type="checkbox"
            checked={noSpaceSameStyle}
            onChange={(event) => setNoSpaceSameStyle(event.target.checked)}
          />
          Don&apos;t add space between paragraphs of the same style
        </label>
      </fieldset>
    </Dialog>
  );
}

function Measure({
  value,
  onChange,
  min,
  max,
  step,
  unit,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled?: boolean;
}) {
  return (
    <span className={styles.field}>
      <input
        type="number"
        className={styles.number}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {unit ? <span className={styles.unit}>{unit}</span> : null}
    </span>
  );
}
