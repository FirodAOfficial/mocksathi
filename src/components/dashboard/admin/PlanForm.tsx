'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { SubscriptionPlan } from '@/db/schema';
import styles from './PlanForm.module.css';

interface FormState {
  name: string;
  priceInInr: string;
  durationDays: string;
  mockLimit: string;
  features: string;
  isDefault: boolean;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_STATE: FormState = {
  name: '',
  priceInInr: '0',
  durationDays: '',
  mockLimit: '',
  features: '',
  isDefault: false,
  isPopular: false,
  isActive: true,
  sortOrder: '0',
};

function stateFromPlan(plan: SubscriptionPlan): FormState {
  return {
    name: plan.name,
    priceInInr: String(plan.priceInInr),
    durationDays: plan.durationDays?.toString() ?? '',
    mockLimit: plan.mockLimit?.toString() ?? '',
    features: plan.features.join('\n'),
    isDefault: plan.isDefault,
    isPopular: plan.isPopular,
    isActive: plan.isActive,
    sortOrder: String(plan.sortOrder),
  };
}

export interface PlanFormProps {
  /** Present for editing an existing plan; absent for "add plan". */
  plan?: SubscriptionPlan;
}

/** Every field on `subscriptionPlans` (`src/db/schema.ts`). Doubles as the add and edit form, same pattern as `ExamForm`. */
export function PlanForm({ plan }: PlanFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(() => (plan ? stateFromPlan(plan) : EMPTY_STATE));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = event.target;
    setValues((current) => ({
      ...current,
      [name]: type === 'checkbox' ? (event.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(plan ? `/api/admin/plans/${plan.id}` : '/api/admin/plans', {
        method: plan ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'Something went wrong. Try again.');
        return;
      }

      router.push('/dashboard/admin/plans');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.section}>
        <div className={styles.grid2}>
          <div className={styles.fieldWide}>
            <label className={styles.label} htmlFor="name">
              Plan name
            </label>
            <input id="name" name="name" className={styles.input} value={values.name} onChange={handleChange} required />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="priceInInr">
              Price (₹)
            </label>
            <input
              id="priceInInr"
              name="priceInInr"
              type="number"
              min={0}
              className={styles.input}
              value={values.priceInInr}
              onChange={handleChange}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="durationDays">
              Duration, in days <span className={styles.optional}>(blank = never expires)</span>
            </label>
            <input
              id="durationDays"
              name="durationDays"
              type="number"
              min={1}
              className={styles.input}
              value={values.durationDays}
              onChange={handleChange}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="mockLimit">
              Mock limit <span className={styles.optional}>(blank = unlimited)</span>
            </label>
            <input
              id="mockLimit"
              name="mockLimit"
              type="number"
              min={0}
              className={styles.input}
              value={values.mockLimit}
              onChange={handleChange}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="sortOrder">
              Sort order <span className={styles.optional}>(lower shows first)</span>
            </label>
            <input
              id="sortOrder"
              name="sortOrder"
              type="number"
              className={styles.input}
              value={values.sortOrder}
              onChange={handleChange}
            />
          </div>

          <div className={styles.fieldWide}>
            <label className={styles.label} htmlFor="features">
              Features <span className={styles.optional}>(one per line, shown as-is on the upgrade page)</span>
            </label>
            <textarea
              id="features"
              name="features"
              className={styles.textarea}
              value={values.features}
              onChange={handleChange}
              placeholder={'Access to all mocks\nDetailed performance analysis\nUnlimited attempts'}
            />
          </div>

          <div className={styles.fieldWide}>
            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxRow}>
                <input type="checkbox" name="isDefault" checked={values.isDefault} onChange={handleChange} />
                Default plan (new signups start here)
              </label>
              <label className={styles.checkboxRow}>
                <input type="checkbox" name="isPopular" checked={values.isPopular} onChange={handleChange} />
                Mark &ldquo;Most Popular&rdquo;
              </label>
              <label className={styles.checkboxRow}>
                <input type="checkbox" name="isActive" checked={values.isActive} onChange={handleChange} />
                Active (visible on the upgrade page)
              </label>
            </div>
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
          {plan ? (submitting ? 'Saving…' : 'Save changes') : submitting ? 'Adding plan…' : 'Add plan'}
        </button>
        <Link href="/dashboard/admin/plans" className={styles.cancel}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
