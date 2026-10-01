import Link from 'next/link';
import type { DocumentQuestion } from '@/db/documentPapers';
import type { WorkbookQuestion } from '@/db/workbookPapers';
import { describeChanges } from '@/exam/document/describe';
import type { DocumentStep } from '@/exam/document/types';
import { describeWorkbookChange } from '@/exam/workbook/describe';
import type { WorkbookStep } from '@/exam/workbook/types';
import styles from './TestWorkbench.module.css';

/**
 * A single-document Word paper's or single-workbook Excel paper's questions, on
 * its workbench.
 *
 * Read-only here: questions are recorded by performing them in the editor, so
 * every change happens on `/author/<id>`. This lists what was recorded, so the
 * workbench still answers "what is in this paper" at a glance.
 */
export function DocumentPaperPanel({
  testId,
  subject,
  hasPassage,
  questions,
}: {
  testId: string;
  subject: 'word' | 'excel';
  hasPassage: boolean;
  questions: (DocumentQuestion | WorkbookQuestion)[];
}) {
  const totalMarks = questions.reduce((total, question) => total + question.marks, 0);
  const word = subject === 'word';
  const passage = word ? 'passage' : 'sheet';
  const application = word ? 'Word editor' : 'spreadsheet';

  const summaries = (steps: unknown[]): string[] =>
    word
      ? (steps as DocumentStep[]).filter((step) => !step.licenceOnly).map((step) => describeChanges(step))
      : (steps as WorkbookStep[]).map((step) => describeWorkbookChange(step));

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Questions</h2>
      <p className={styles.cardNote}>
        {!hasPassage
          ? `Enter the ${passage} once in the ${application}, then record each question by performing it on the ${passage}. The operation is detected for you — nothing to describe in a form.`
          : questions.length === 0
            ? `The ${passage} is saved. Record the questions by performing each one in the ${application}.`
            : `${questions.length} question${questions.length === 1 ? '' : 's'}, ${totalMarks} mark${totalMarks === 1 ? '' : 's'} in total, all on one ${passage}. Candidates may answer them in any order.`}
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
                {summaries(question.steps).map((summary, index) => (
                  <span className={styles.asks} key={index}>
                    {summary}
                  </span>
                ))}
              </div>
            </div>
            <div className={styles.questionActions} />
          </div>
        ))}
      </div>

      <Link href={`/author/${testId}`} className={styles.addButton}>
        {hasPassage ? `Open the paper in the ${application} →` : `Enter the ${passage} in the ${application} →`}
      </Link>
    </div>
  );
}
