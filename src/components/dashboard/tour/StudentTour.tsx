'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { DashboardIcon } from '../icons/DashboardIcon';
import { computeTooltipPosition, type PlacementResult } from './tourPlacement';
import { STUDENT_TOUR_STEPS } from './tourSteps';
import styles from './StudentTour.module.css';

export interface StudentTourProps {
  open: boolean;
  onClose: () => void;
}

/** How long to wait for a step's target to appear after navigating to its page, before giving up on that step. */
const FIND_TARGET_TIMEOUT_MS = 3000;
const FIND_TARGET_POLL_MS = 50;

const LAST_STEP_INDEX = STUDENT_TOUR_STEPS.length - 1;

/**
 * The spotlight-and-tooltip walkthrough itself.
 *
 * Mounted once inside `PortalShell`, which does not unmount between
 * `/dashboard/*` navigations — that's what lets `stepIndex` survive the
 * page changes a multi-page tour needs, with no URL param or localStorage
 * bookkeeping required to carry it across them.
 *
 * A step whose target never appears (no mocks published yet, so
 * `TodaysMockCard` renders nothing) is skipped automatically rather than
 * stalling the tour on a spotlight that can never be shown — see the
 * find-target effect's timeout.
 */
export function StudentTour({ open, onClose }: StudentTourProps) {
  const pathname = usePathname();
  const router = useRouter();
  const titleId = useId();
  const [stepIndex, setStepIndex] = useState(0);
  const [placement, setPlacement] = useState<(PlacementResult & { target: DOMRect }) | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);

  const step = STUDENT_TOUR_STEPS[stepIndex];

  // Adjusting state from a prop/derived-value change, not synchronizing with
  // an external system — done during render, same pattern (and reasoning)
  // as `PortalShell`'s own `lastPathname`/`lastAvatarUrl`, not an effect:
  // React explicitly permits a conditional `setState` mid-render for this,
  // and it avoids the extra render an effect-based reset would cost.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setStepIndex(0);
      setPlacement(null);
    }
  }

  const [lastStepIndex, setLastStepIndex] = useState(stepIndex);
  if (stepIndex !== lastStepIndex) {
    setLastStepIndex(stepIndex);
    setPlacement(null);
  }

  const advance = useCallback(() => {
    if (stepIndex >= LAST_STEP_INDEX) {
      onClose();
      // The last step's own page is `/dashboard/profile` (`tourSteps.ts`) —
      // without this, finishing the tour leaves the candidate sitting there
      // instead of on the dashboard home they started from.
      router.push('/dashboard');
      return;
    }
    setStepIndex((index) => index + 1);
  }, [stepIndex, onClose, router]);

  const back = useCallback(() => {
    setStepIndex((index) => Math.max(0, index - 1));
  }, []);

  // Navigate to the step's page if the tour isn't already there. The actual
  // side effect (`router.push`) belongs in an effect; nothing here calls
  // `setState` directly, so there's no cascading-render risk to avoid.
  useEffect(() => {
    if (!open || !step) return;
    if (pathname !== step.page) router.push(step.page);
  }, [open, step, pathname, router]);

  // Find and measure the step's target once its page is showing. Polls
  // rather than relying on a single post-navigation effect run: the page
  // just swapped in via a Server Component fetch, so the element isn't
  // guaranteed to exist on the very first paint after the route changes.
  useEffect(() => {
    if (!open || !step || pathname !== step.page) return;

    cancelledRef.current = false;
    const deadline = Date.now() + FIND_TARGET_TIMEOUT_MS;

    function measure(element: HTMLElement) {
      const rect = element.getBoundingClientRect();
      const tooltipSize = tooltipRef.current?.getBoundingClientRect();
      const result = computeTooltipPosition(
        rect,
        step!.placement,
        { width: tooltipSize?.width ?? 300, height: tooltipSize?.height ?? 150 },
        { width: window.innerWidth, height: window.innerHeight },
      );
      setPlacement({ ...result, target: rect });
    }

    function tick() {
      if (cancelledRef.current) return;
      const element = document.querySelector<HTMLElement>(step!.selector);
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        // Give the smooth scroll a moment to land before measuring — an
        // immediate `getBoundingClientRect()` would catch it mid-scroll.
        window.setTimeout(() => {
          if (cancelledRef.current) return;
          measure(element);
        }, 260);
        return;
      }
      if (Date.now() >= deadline) {
        advance();
        return;
      }
      window.setTimeout(tick, FIND_TARGET_POLL_MS);
    }

    tick();

    function handleReflow() {
      const element = document.querySelector<HTMLElement>(step!.selector);
      if (element) measure(element);
    }
    window.addEventListener('resize', handleReflow);
    window.addEventListener('scroll', handleReflow, true);

    return () => {
      cancelledRef.current = true;
      window.removeEventListener('resize', handleReflow);
      window.removeEventListener('scroll', handleReflow, true);
    };
  }, [open, step, pathname, advance]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === LAST_STEP_INDEX;

  return (
    <div className={styles.layer} aria-live="polite">
      <div className={styles.backdrop} />

      {placement && (
        <div
          className={styles.cutout}
          style={{
            top: placement.target.top - 8,
            left: placement.target.left - 8,
            width: placement.target.width + 16,
            height: placement.target.height + 16,
          }}
        />
      )}

      <div
        ref={tooltipRef}
        className={styles.tooltip}
        role="dialog"
        aria-labelledby={titleId}
        style={placement ? { top: placement.top, left: placement.left } : { opacity: 0 }}
      >
        <div className={styles.tooltipHeader}>
          <span className={styles.step}>
            Step {stepIndex + 1} of {STUDENT_TOUR_STEPS.length}
          </span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close tour">
            <DashboardIcon name="x" size={14} />
          </button>
        </div>

        <h2 id={titleId} className={styles.title}>
          {step.title}
        </h2>
        <p className={styles.body}>{step.body}</p>

        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={onClose}>
            Skip tour
          </button>
          <div className={styles.stepActions}>
            {!isFirst && (
              <button type="button" className={styles.secondary} onClick={back}>
                Back
              </button>
            )}
            <button type="button" className={styles.primary} onClick={advance}>
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
