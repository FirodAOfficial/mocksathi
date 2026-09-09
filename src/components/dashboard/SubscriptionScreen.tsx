'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import headerStyles from './AnalysisScreen.module.css';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './SubscriptionScreen.module.css';

export interface SubscriptionPlanView {
  id: string;
  name: string;
  priceInInr: number;
  durationDays: number | null;
  mockLimit: number | null;
  features: string[];
  isPopular: boolean;
}

export interface SubscriptionScreenProps {
  plans: SubscriptionPlanView[];
  currentPlanId: string;
  isSubscribed: boolean;
  daysRemaining: number | null;
  mockLimit: number | null;
  mocksUsed: number;
}

function formatDuration(days: number | null): string {
  if (!days) return 'No expiry';
  if (days % 365 === 0) return `Valid for ${days / 365} year${days === 365 ? '' : 's'}`;
  if (days % 30 === 0) return `Valid for ${days / 30} months`;
  return `Valid for ${days} days`;
}

export function SubscriptionScreen({
  plans,
  currentPlanId,
  isSubscribed,
  daysRemaining,
  mockLimit,
  mocksUsed,
}: SubscriptionScreenProps) {
  const router = useRouter();
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoose(planId: string) {
    setError(null);
    setPendingPlanId(planId);
    try {
      const response = await fetch('/api/profile/subscription', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'Something went wrong. Try again.');
        return;
      }

      router.refresh();
    } finally {
      setPendingPlanId(null);
    }
  }

  return (
    <>
      <div className={headerStyles.header}>
        <h1 className={headerStyles.title}>Subscription</h1>
        <p className={headerStyles.subtitle}>Upgrade for full access, or see what your current plan covers.</p>
      </div>

      <div className={styles.currentCard}>
        <div>
          <p className={styles.currentLabel}>Current plan</p>
          <p className={styles.currentPlanName}>{plans.find((plan) => plan.id === currentPlanId)?.name ?? 'Free'}</p>
          <p className={styles.currentDetail}>
            {isSubscribed
              ? daysRemaining !== null
                ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`
                : 'No expiry'
              : mockLimit !== null
                ? `${mocksUsed} of ${mockLimit} free mocks used`
                : 'Unlimited mocks'}
          </p>
        </div>
        {!isSubscribed && mockLimit !== null && (
          <div className={styles.usageBar}>
            <div className={styles.usageTrack}>
              <div
                className={styles.usageFill}
                style={{ width: `${Math.min(100, (mocksUsed / mockLimit) * 100)}%` }}
              />
            </div>
            <p className={styles.usageLabel}>
              {Math.max(0, mockLimit - mocksUsed)} left
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.plansGrid}>
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <div key={plan.id} className={plan.isPopular ? styles.planCardPopular : styles.planCard}>
              {plan.isPopular && (
                <span className={styles.popularBadge}>
                  <DashboardIcon name="star" size={12} />
                  Most Popular
                </span>
              )}
              <div>
                <p className={styles.planName}>{plan.name}</p>
                <p className={styles.planDuration}>{formatDuration(plan.durationDays)}</p>
              </div>
              <div className={styles.planPriceRow}>
                <span className={plan.priceInInr === 0 ? styles.planPriceFree : styles.planPrice}>
                  {plan.priceInInr === 0 ? 'Free' : `₹${plan.priceInInr.toLocaleString('en-IN')}`}
                </span>
                {plan.priceInInr > 0 && <span className={styles.planPriceUnit}>one-time</span>}
              </div>
              <div className={styles.featureList}>
                {(plan.mockLimit ? [`${plan.mockLimit} mock attempts`] : ['Unlimited attempts'])
                  .concat(plan.features)
                  .map((feature, index) => (
                    // Index, not the text, as the key: an admin-authored feature can
                    // legitimately repeat the auto-prepended limit line's wording
                    // (e.g. also typing "Unlimited attempts" as a bullet) — see the
                    // duplicate-key warning this fixed.
                    <div className={styles.featureItem} key={`${index}-${feature}`}>
                      <DashboardIcon name="file-check-2" size={14} />
                      {feature}
                    </div>
                  ))}
              </div>
              <button
                type="button"
                className={isCurrent ? styles.planCtaCurrent : plan.isPopular ? styles.planCtaPopular : styles.planCta}
                onClick={() => handleChoose(plan.id)}
                disabled={isCurrent || pendingPlanId !== null}
              >
                {isCurrent ? 'Current Plan' : pendingPlanId === plan.id ? 'Activating…' : `Choose ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className={styles.footerNote}>
        <DashboardIcon name="shield" size={14} />
        No payment gateway is connected yet — choosing a plan activates it immediately, at no charge.
      </p>
    </>
  );
}
