'use client';

import { Popover } from '../controls/Popover';
import { orderIn } from '@/exam/document/topics';
import styles from './TopicMultiSelect.module.css';

export interface TopicMultiSelectProps {
  /** The topics on offer, in the order they are shown and stored. */
  options: readonly string[];
  /** What is ticked. */
  value: string[];
  onChange: (topics: string[]) => void;
  /**
   * True while the ticks are still the ones read off the question's operation.
   * The "use detected topics again" link appears once the admin has changed
   * them, so getting back to the automatic choice is one click.
   */
  automatic: boolean;
  onReset: () => void;
  /** For a `<label htmlFor>` outside the control. */
  id?: string;
  /** Outlined as missing; the caller says why in text beside it. */
  invalid?: boolean;
}

/**
 * A dropdown of checkboxes for a question's topics.
 *
 * Built on the ribbon's `Popover`, so it dismisses, positions and returns
 * focus exactly as the editor's own menus do. The label is the caller's, so it
 * sits in whichever form layout it is placed in.
 */
export function TopicMultiSelect({ options, value, onChange, automatic, onReset, id, invalid }: TopicMultiSelectProps) {
  const toggle = (topic: string): void => {
    onChange(value.includes(topic) ? value.filter((entry) => entry !== topic) : orderIn(options, [...value, topic]));
  };

  return (
    <div className={styles.wrap}>
      <Popover
        trigger={({ open, toggle: toggleOpen, id: popoverId, controls }) => (
          <button
            type="button"
            id={id ?? popoverId}
            className={`${styles.multiTrigger} ${invalid ? styles.invalid : ''}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={controls}
            onClick={toggleOpen}
            data-popover-trigger
          >
            <span className={styles.multiValue}>
              {value.length === 0 ? (
                <span className={styles.multiPlaceholder}>Choose one or more topics</span>
              ) : (
                value.map((topic) => (
                  <span className={styles.chip} key={topic}>
                    {topic}
                  </span>
                ))
              )}
            </span>
            <span aria-hidden="true">▾</span>
          </button>
        )}
      >
        {() => (
          <div className={styles.multiMenu} role="listbox" aria-multiselectable="true" aria-label="Topics">
            {options.map((topic) => (
              <label className={styles.multiOption} key={topic}>
                <input type="checkbox" checked={value.includes(topic)} onChange={() => toggle(topic)} />
                {topic}
              </label>
            ))}
          </div>
        )}
      </Popover>

      {!automatic ? (
        <button type="button" className={styles.linkButton} onClick={onReset}>
          Use the detected topics again
        </button>
      ) : null}
    </div>
  );
}
