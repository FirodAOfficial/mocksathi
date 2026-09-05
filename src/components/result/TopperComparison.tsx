import { formatClock, type ExamResult, type ScoreLine } from '@/exam/result';
import { HandNote } from './ResultArt';
import styles from './TopperComparison.module.css';

type Column = {
  key: 'topper' | 'you' | 'average';
  heading: string;
  line: ScoreLine;
};

/** Side-by-side comparison of the candidate against the topper and the mean. */
export function TopperComparison({ result }: { result: ExamResult }) {
  const columns: Column[] = [
    { key: 'topper', heading: 'TOPPER', line: result.topper },
    { key: 'you', heading: 'YOU', line: result.you },
    { key: 'average', heading: 'AVERAGE', line: result.average },
  ];

  return (
    <section className={styles.section} aria-label="Compare with topper">
      <h2 className={styles.title}>
        <span aria-hidden="true">👑</span> Compare with Topper
      </h2>

      <div className={styles.grid}>
        {columns.map(({ key, heading, line }) => (
          <table key={key} className={`${styles.table} ${styles[key] ?? ''}`}>
            <caption className={styles.caption}>{heading}</caption>
            <tbody>
              <tr>
                <th scope="row">Score</th>
                <td className={styles.emphasis}>
                  {line.score.toFixed(2)} / {line.maxScore.toFixed(2)}
                </td>
              </tr>
              <tr>
                <th scope="row">Accuracy</th>
                <td className={styles.emphasis}>{line.accuracy.toFixed(2)}%</td>
              </tr>
              <tr>
                <th scope="row">Correct</th>
                <td>{line.correct}</td>
              </tr>
              <tr>
                <th scope="row">Wrong</th>
                <td className={styles.wrong}>{line.wrong}</td>
              </tr>
              <tr>
                <th scope="row">Unattempted</th>
                <td>{line.unattempted}</td>
              </tr>
              <tr>
                <th scope="row">Time</th>
                <td className={styles.emphasis}>{formatClock(line.timeSeconds)}</td>
              </tr>
            </tbody>
          </table>
        ))}

        <HandNote className={styles.note}>{'Compare\nLearn\nImprove'}</HandNote>
      </div>
    </section>
  );
}
