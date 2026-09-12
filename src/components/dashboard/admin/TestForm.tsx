'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { EXAM_STATUSES, TEST_SUBJECTS, type Test } from '@/db/schema';
import styles from './TestForm.module.css';

/**
 * Every field flat and as a string, the way `ExamForm` holds its state — one
 * `handleChange` for the whole form, and the parsing done once on the server
 * (`parseTestInput`) rather than twice, differently.
 */
type FormState = Record<
  'examId' | 'name' | 'subject' | 'description' | 'sectionName' | 'tagline' | 'durationMinutes' | 'qualifyingMarks' | 'status',
  string
>;

const EMPTY_STATE: FormState = {
  examId: '',
  name: '',
  subject: 'word',
  description: '',
  sectionName: '',
  tagline: '',
  durationMinutes: '15',
  qualifyingMarks: '0',
  status: 'draft',
};

const SUBJECT_LABEL: Record<(typeof TEST_SUBJECTS)[number], string> = {
  word: 'Word — a passage to format',
  excel: 'Excel — a sheet to work on',
};

function stateFromTest(test: Test): FormState {
  return {
    examId: test.examId,
    name: test.name,
    subject: test.subject,
    description: test.description ?? '',
    sectionName: test.sectionName,
    tagline: test.tagline ?? '',
    durationMinutes: String(test.durationMinutes),
    qualifyingMarks: String(test.qualifyingMarks),
    status: test.status,
  };
}

export interface TestFormProps {
  /** Every exam a test can belong to, for the picker. */
  exams: { id: string; name: string }[];
  /** Present on the edit form; absent when writing a new test. */
  test?: Test;
  /** True once the paper has questions, which locks its application. */
  hasQuestions?: boolean;
}

/**
 * The test itself — what it is called, which exam it belongs to, how long it
 * runs. Its questions are written on the test's own page, not here: they are a
 * different job, done many times over, and a form that did both would open with
 * fifteen collapsed panels above the one field you came to change.
 */
export function TestForm({ exams, test, hasQuestions = false }: TestFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(() => (test ? stateFromTest(test) : EMPTY_STATE));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(test ? `/api/admin/tests/${test.id}` : '/api/admin/tests', {
        method: test ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });

      const body = (await response.json().catch(() => null)) as { detail?: string; test?: Test } | null;
      if (!response.ok) {
        setError(body?.detail ?? 'Something went wrong. Try again.');
        return;
      }

      // Straight to the paper's own page: a test with no questions is not
      // finished, and this is where they get written.
      router.push(`/dashboard/admin/tests/${body?.test?.id ?? test?.id ?? ''}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>The paper</p>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Test name
            </label>
            <input
              id="name"
              name="name"
              className={styles.input}
              placeholder="Word Practical — Paper 1"
              value={values.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="examId">
              Exam
            </label>
            <select id="examId" name="examId" className={styles.select} value={values.examId} onChange={handleChange} required>
              <option value="">Choose an exam…</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>
            {exams.length === 0 && (
              <p className={styles.hint}>
                No exams yet — <Link href="/dashboard/admin/exams/new">add one first</Link>.
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="subject">
              Application
            </label>
            <select
              id="subject"
              name="subject"
              className={styles.select}
              value={values.subject}
              onChange={handleChange}
              disabled={hasQuestions}
            >
              {TEST_SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {SUBJECT_LABEL[subject]}
                </option>
              ))}
            </select>
            <p className={styles.hint}>
              {hasQuestions
                ? 'Locked: this paper already has questions written for it.'
                : 'A paper is all Word or all Excel — it cannot mix the two.'}
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="sectionName">
              Section name <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="sectionName"
              name="sectionName"
              className={styles.input}
              placeholder={values.subject === 'excel' ? 'Spreadsheet' : 'Word Processing'}
              value={values.sectionName}
              onChange={handleChange}
            />
          </div>

          <div className={styles.fieldWide}>
            <label className={styles.label} htmlFor="description">
              Description <span className={styles.optional}>(optional, for admins)</span>
            </label>
            <textarea
              id="description"
              name="description"
              className={styles.textarea}
              value={values.description}
              onChange={handleChange}
            />
          </div>

          <div className={styles.fieldWide}>
            <label className={styles.label} htmlFor="tagline">
              Tagline <span className={styles.optional}>(optional, shown to the candidate)</span>
            </label>
            <input
              id="tagline"
              name="tagline"
              className={styles.input}
              placeholder="Your Progress Brings You Closer to Success"
              value={values.tagline}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Timing &amp; passing</p>
        <div className={styles.grid3}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="durationMinutes">
              Duration (minutes)
            </label>
            <input
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              min={1}
              max={600}
              className={styles.input}
              value={values.durationMinutes}
              onChange={handleChange}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="qualifyingMarks">
              Qualifying marks
            </label>
            <input
              id="qualifyingMarks"
              name="qualifyingMarks"
              type="number"
              min={0}
              className={styles.input}
              value={values.qualifyingMarks}
              onChange={handleChange}
            />
            <p className={styles.hint}>The total is added up from the questions, so it is not set here.</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="status">
              Status
            </label>
            <select id="status" name="status" className={styles.select} value={values.status} onChange={handleChange}>
              {EXAM_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status[0]!.toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={submitting}>
          {test ? (submitting ? 'Saving…' : 'Save changes') : submitting ? 'Creating…' : 'Create test'}
        </button>
        <Link href={test ? `/dashboard/admin/tests/${test.id}` : '/dashboard/admin/tests'} className={styles.cancel}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
