import 'server-only';
import { attemptedTestCountForUser } from '@/db/attempts';
import { currentPlanForUser } from '@/db/plans';

/**
 * Where a candidate stands against their plan's free-mock allowance.
 *
 * One place owns the "has this candidate used up their free tier" rule so it
 * isn't redefined slightly differently on every page that needs it (the
 * sidebar widget, the dashboard home, the mocks list, the exam start gate).
 */
export interface MockLimitStatus {
  /** Distinct papers ever sat — see `attemptedTestCountForUser`. */
  mocksUsed: number;
  /** Null means unlimited. */
  mockLimit: number | null;
  isSubscribed: boolean;
  /**
   * True once a candidate on a capped, unsubscribed plan has used every mock
   * it allows — starting a *new* paper should be blocked; retaking one
   * already sat never trips this (see `attemptedTestCountForUser`'s doc).
   */
  limitReached: boolean;
}

export async function mockLimitStatusForUser(userId: string): Promise<MockLimitStatus> {
  const [plan, mocksUsed] = await Promise.all([currentPlanForUser(userId), attemptedTestCountForUser(userId)]);

  const mockLimit = plan?.plan.mockLimit ?? null;
  const isSubscribed = plan?.isSubscribed ?? false;
  const limitReached = !isSubscribed && mockLimit !== null && mocksUsed >= mockLimit;

  return { mocksUsed, mockLimit, isSubscribed, limitReached };
}
