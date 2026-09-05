'use client';

import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { CHARACTER_SCALE_OPTIONS, type TextEffect } from '@/editor/extensions/CharacterFormat';
import { setCharacterScale, setCharacterSpacing, setTextEffect } from '@/editor/ribbonActions';
import { Dialog } from './Dialog';
import styles from './FontDialog.module.css';

export interface FontDialogProps {
  editor: Editor;
  onClose: () => void;
}

type SpacingMode = 'normal' | 'expanded' | 'condensed';

/**
 * Word's Font dialog, reached from the Font group's launcher arrow.
 *
 * It carries the formatting Word keeps off the ribbon: the Emboss and Engrave
 * effects, and the Advanced tab's character Scale and Spacing. Everything here
 * applies to the selection when Apply is pressed, matching Word — a dialog does
 * not take effect as you change its fields.
 */
export function FontDialog({ editor, onClose }: FontDialogProps) {
  const current = editor.getAttributes('textStyle');

  const [effect, setEffect] = useState<TextEffect | null>((current.effect as TextEffect) ?? null);
  const [scale, setScale] = useState<number>(typeof current.charScale === 'number' ? current.charScale : 100);

  const currentSpacing = typeof current.charSpacing === 'number' ? current.charSpacing : 0;
  const [spacingMode, setSpacingMode] = useState<SpacingMode>(
    currentSpacing > 0 ? 'expanded' : currentSpacing < 0 ? 'condensed' : 'normal',
  );
  const [spacingBy, setSpacingBy] = useState<number>(Math.abs(currentSpacing) || 1);

  const apply = (): void => {
    setTextEffect(editor, effect);
    setCharacterScale(editor, scale === 100 ? null : scale);
    setCharacterSpacing(
      editor,
      spacingMode === 'normal' ? null : spacingMode === 'expanded' ? spacingBy : -spacingBy,
    );
    onClose();
  };

  return (
    <Dialog
      title="Font"
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
        <legend className={styles.legend}>Effects</legend>

        {/*
          Radio rather than two checkboxes: text is either raised or carved, and
          Word disables one when the other is ticked.
        */}
        {([
          { value: null, label: 'None' },
          { value: 'emboss', label: 'Emboss' },
          { value: 'engrave', label: 'Engrave' },
        ] as const).map((option) => (
          <label key={String(option.value)} className={styles.choice}>
            <input
              type="radio"
              name="text-effect"
              checked={effect === option.value}
              onChange={() => setEffect(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Character Spacing</legend>

        <div className={styles.field}>
          <label htmlFor="font-scale">Scale:</label>
          <select
            id="font-scale"
            className={styles.input}
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
          >
            {CHARACTER_SCALE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}%
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="font-spacing">Spacing:</label>
          <select
            id="font-spacing"
            className={styles.input}
            value={spacingMode}
            onChange={(event) => setSpacingMode(event.target.value as SpacingMode)}
          >
            <option value="normal">Normal</option>
            <option value="expanded">Expanded</option>
            <option value="condensed">Condensed</option>
          </select>

          <label htmlFor="font-spacing-by" className={styles.by}>
            By:
          </label>
          <input
            id="font-spacing-by"
            type="number"
            className={styles.number}
            min={0}
            max={20}
            step={0.1}
            value={spacingBy}
            disabled={spacingMode === 'normal'}
            onChange={(event) => setSpacingBy(Number(event.target.value))}
          />
          <span className={styles.unit}>pt</span>
        </div>
      </fieldset>

      <p className={styles.preview} data-effect={effect ?? undefined}>
        Preview
      </p>
    </Dialog>
  );
}
