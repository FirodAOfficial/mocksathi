'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { EXAM_STATUSES, type Exam } from '@/db/schema';
import styles from './ExamForm.module.css';

const FIELD_NAMES = [
  'name',
  'category',
  'organiserName',
  'organiserWebsite',
  'description',
  'notificationUrl',
  'registrationUrl',
  'formSubmissionStartDate',
  'registrationStartDate',
  'registrationLastDate',
  'examDate',
  'examEndDate',
  'admitCardDate',
  'resultDate',
  'qualificationRequirement',
  'ageLimitMin',
  'ageLimitMax',
  'applicationFee',
  'totalVacancies',
  'examMode',
  'status',
] as const;

type FieldName = (typeof FIELD_NAMES)[number];
type FormState = Record<FieldName, string>;

const EMPTY_STATE: FormState = Object.fromEntries(FIELD_NAMES.map((field) => [field, ''])) as FormState;
EMPTY_STATE.status = 'draft';

/** `Exam`'s nullable/typed columns -> the form's flat string state. */
function stateFromExam(exam: Exam): FormState {
  return {
    name: exam.name,
    category: exam.category ?? '',
    organiserName: exam.organiserName,
    organiserWebsite: exam.organiserWebsite ?? '',
    description: exam.description ?? '',
    notificationUrl: exam.notificationUrl ?? '',
    registrationUrl: exam.registrationUrl ?? '',
    formSubmissionStartDate: exam.formSubmissionStartDate ?? '',
    registrationStartDate: exam.registrationStartDate ?? '',
    registrationLastDate: exam.registrationLastDate ?? '',
    examDate: exam.examDate ?? '',
    examEndDate: exam.examEndDate ?? '',
    admitCardDate: exam.admitCardDate ?? '',
    resultDate: exam.resultDate ?? '',
    qualificationRequirement: exam.qualificationRequirement ?? '',
    ageLimitMin: exam.ageLimitMin?.toString() ?? '',
    ageLimitMax: exam.ageLimitMax?.toString() ?? '',
    applicationFee: exam.applicationFee ?? '',
    totalVacancies: exam.totalVacancies?.toString() ?? '',
    examMode: exam.examMode ?? '',
    status: exam.status,
  };
}

export interface ExamFormProps {
  /** Present for `/dashboard/admin/exams/[id]/edit`; absent for the "add exam" form. */
  exam?: Exam;
}

/** Every field on `exams` (`src/db/schema.ts`) except the auto-derived slug. Doubles as the add and edit form. */
export function ExamForm({ exam }: ExamFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(() => (exam ? stateFromExam(exam) : EMPTY_STATE));
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
      const response = await fetch(exam ? `/api/admin/exams/${exam.id}` : '/api/admin/exams', {
        method: exam ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'Something went wrong. Try again.');
        return;
      }

      router.push('/dashboard/admin/exams');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Basic information</p>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Exam name
            </label>
            <input id="name" name="name" className={styles.input} value={values.name} onChange={handleChange} required />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="category">
              Category <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="category"
              name="category"
              className={styles.input}
              placeholder="SSC, Banking, Railway…"
              value={values.category}
              onChange={handleChange}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="organiserName">
              Organiser name
            </label>
            <input
              id="organiserName"
              name="organiserName"
              className={styles.input}
              value={values.organiserName}
              onChange={handleChange}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="organiserWebsite">
              Organiser website <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="organiserWebsite"
              name="organiserWebsite"
              type="url"
              className={styles.input}
              placeholder="https://ssc.nic.in"
              value={values.organiserWebsite}
              onChange={handleChange}
            />
          </div>
          <div className={styles.fieldWide}>
            <label className={styles.label} htmlFor="description">
              Details <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              className={styles.textarea}
              value={values.description}
              onChange={handleChange}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="notificationUrl">
              Notification link <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="notificationUrl"
              name="notificationUrl"
              type="url"
              className={styles.input}
              placeholder="Link to the official PDF"
              value={values.notificationUrl}
              onChange={handleChange}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="registrationUrl">
              Registration link <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="registrationUrl"
              name="registrationUrl"
              type="url"
              className={styles.input}
              value={values.registrationUrl}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Important dates</p>
        <div className={styles.grid3}>
          {(
            [
              ['formSubmissionStartDate', 'Form submission start'],
              ['registrationStartDate', 'Registration start'],
              ['registrationLastDate', 'Registration last date'],
              ['examDate', 'Exam date'],
              ['examEndDate', 'Exam end date'],
              ['admitCardDate', 'Admit card date'],
              ['resultDate', 'Result date'],
            ] as const
          ).map(([field, label]) => (
            <div className={styles.field} key={field}>
              <label className={styles.label} htmlFor={field}>
                {label} <span className={styles.optional}>(optional)</span>
              </label>
              <input id={field} name={field} type="date" className={styles.input} value={values[field]} onChange={handleChange} />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Eligibility &amp; fees</p>
        <div className={styles.grid2}>
          <div className={styles.fieldWide}>
            <label className={styles.label} htmlFor="qualificationRequirement">
              Qualification requirement <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              id="qualificationRequirement"
              name="qualificationRequirement"
              className={styles.textarea}
              value={values.qualificationRequirement}
              onChange={handleChange}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ageLimitMin">
              Minimum age <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="ageLimitMin"
              name="ageLimitMin"
              type="number"
              min={0}
              className={styles.input}
              value={values.ageLimitMin}
              onChange={handleChange}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ageLimitMax">
              Maximum age <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="ageLimitMax"
              name="ageLimitMax"
              type="number"
              min={0}
              className={styles.input}
              value={values.ageLimitMax}
              onChange={handleChange}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="applicationFee">
              Application fee <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="applicationFee"
              name="applicationFee"
              className={styles.input}
              placeholder="₹100 Gen / Free SC-ST-PwD"
              value={values.applicationFee}
              onChange={handleChange}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="totalVacancies">
              Total vacancies <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="totalVacancies"
              name="totalVacancies"
              type="number"
              min={0}
              className={styles.input}
              value={values.totalVacancies}
              onChange={handleChange}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="examMode">
              Exam mode <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="examMode"
              name="examMode"
              className={styles.input}
              placeholder="Online, Offline, Both…"
              value={values.examMode}
              onChange={handleChange}
            />
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
          {exam ? (submitting ? 'Saving…' : 'Save changes') : submitting ? 'Adding exam…' : 'Add exam'}
        </button>
        <Link href="/dashboard/admin/exams" className={styles.cancel}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
