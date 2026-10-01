import Link from 'next/link';
import type { DocumentQuestion } from '@/db/documentPapers';
import { describeChanges } from '@/exam/document/describe';
import styles from './TestWorkbench.module.css';

/**
 * A single-document Word paper's questions, on its workbench.
 *
 * Read-only here: questions are recorded by performing them in the editor, so
 * every change happens on `/author/<id>`. This lists what was recorded, so the
 * workbench still answers "what is in this paper" at a glance.
 */
export function DocumentPaperPanel({
  testId,
  hasPassage,
  questions,
}: {
  testId: string;
  hasPassage: boolean;
  questions: DocumentQuestion[];
}) {
  const totalMarks = questions.reduce((total, question) => total + question.marks, 0);

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Questions</h2>
      <p className={styles.cardNote}>
        {!hasPassage
          ? 'Type the passage once in the Word editor, then record each question by performing it on the passage. The operation is detected for you — nothing to describe in a form.'
          : questions.length === 0
            ? 'The passage is saved. Record the questions by performing each one in the editor.'
            : `${questions.length} question${questions.length === 1 ? '' : 's'}, ${totalMarks} mark${totalMarks === 1 ? '' : 's'} in total, all on one passage. Candidates may answer them in any order.`}
      </p>

      <div className={styles.list}>
        {questions.map((question) => (
          <div className={styles.questionRow} key={question.id}>
            <span className={styles.number}>{question.position}</span>
            <div className={styles.questionMain}>
              <p className={styles.questionInstruction}>{question.instructionEn}</p>
              <div className={styles.questionMeta}>
                <span className={styles.topic}>{question.topic}</span>
                <span className={styles[question.difficulty] ?? styles.badge}>{question.difficulty}</span>
                <span>{question.marks} marks</span>
                {question.steps
                  .filter((step) => !step.licenceOnly)
                  .map((step, index) => (
                    <span className={styles.asks} key={index}>
                      {describeChanges(step)}
                    </span>
                  ))}
              </div>
            </div>
            <div className={styles.questionActions} />
          </div>
        ))}
      </div>

      <Link href={`/author/${testId}`} className={styles.addButton}>
        {hasPassage ? 'Open the paper in the Word editor →' : 'Write the passage in the Word editor →'}
      </Link>
    </div>
  );
}
