'use client';

import { Dialog } from './Dialog';
import styles from './WordCountDialog.module.css';

export interface WordCountDialogProps {
  words: number;
  characters: number;
  paragraphs: number;
  onClose: () => void;
}

export function WordCountDialog({ words, characters, paragraphs, onClose }: WordCountDialogProps) {
  const rows: [string, number][] = [
    ['Words', words],
    ['Characters (with spaces)', characters],
    ['Paragraphs', paragraphs],
  ];

  return (
    <Dialog
      title="Word Count"
      onClose={onClose}
      footer={
        <button type="button" className={styles.button} onClick={onClose}>
          Close
        </button>
      }
    >
      <dl className={styles.list}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt>{label}</dt>
            <dd>{value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
