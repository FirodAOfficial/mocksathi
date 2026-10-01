'use client';

import { Popover } from '../controls/Popover';
import { DOCUMENT_TOPICS, orderTopics, type DocumentTopic } from '@/exam/document/topics';
import styles from './DocumentAuthoringShell.module.css';

export interface TopicMultiSelectProps {
  /** What is ticked. */
  value: DocumentTopic[];
  onChange: (topics: DocumentTopic[]) => void;
  /**
   * True while the selection is still the one read off the recorded operation.
   * Shown beside the field, so the admin knows the ticks were made for them —
   * and that changing any of them is theirs to do.
   */
  automatic: boolean;
  /** Puts the detected topics back after the admin has changed them. */
  onReset: () => void;
}

/**
 * A dropdown of checkboxes for a question's topics.
 *
 * Built on the ribbon's `Popover`, so it dismisses, positions and returns focus
 * exactly as the editor's own menus do on the same screen.
 */
export function TopicMultiSelect({ value, onChange, automatic, onReset }: TopicMultiSelectProps) {
  const toggle = (topic: DocumentTopic): void => {
    onChange(value.includes(topic) ? value.filter((entry) => entry !== topic) : orderTopics([...value, topic]));
  };

  return (
    <div className={styles.field}>
      <span>
        Topic{' '}
        <span className={styles.hint}>
          {automatic ? 'Selected from the detected operation — change it if you like.' : 'Chosen by you.'}
        </span>
      </span>

      <Popover
        trigger={({ open, toggle: toggleOpen, id, controls }) => (
          <button
            type="button"
            id={id}
            className={styles.multiTrigger}
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
            {DOCUMENT_TOPICS.map((topic) => (
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
