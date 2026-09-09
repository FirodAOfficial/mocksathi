import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { requireUser } from '@/auth/cookies';
import { PortalShell, type PlanWidgetData } from '@/components/dashboard/PortalShell';
import { dashboardDataFor, fixtureMocksUsedCount } from '@/dashboard/seedDashboard';
import { currentPlanForUser } from '@/db/plans';

const inter = Inter({ subsets: ['latin'], variable: '--db-font' });

export const metadata: Metadata = {
  title: 'Dashboard · Mocksathi',
  description: 'Track streaks, mocks, and performance for your target exam.',
};

/**
 * Shared chrome for every candidate-portal route under `/dashboard`.
 *
 * The candidate portal is a distinct visual product from the document editor
 * at `/editor` (Inter, card-based, `#1c6ef2` accent vs. the Office chrome in
 * `globals.css`), so its font and shell are scoped here rather than touching
 * the root layout. `requireUser` sends a signed-out visitor to `/login`
 * before anything here renders.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const simplifiedMenu = user.role !== 'admin';

  const [data, currentPlan] = await Promise.all([
    dashboardDataFor(user),
    // Only the simplified menu shows the plan widget — skip the query for admins.
    simplifiedMenu ? currentPlanForUser(user.id) : Promise.resolve(null),
  ]);
  const unreadNotifications = data.notifications.filter((notification) => !notification.read).length;

  const planWidget: PlanWidgetData | undefined = currentPlan
    ? {
        planName: currentPlan.plan.name,
        isSubscribed: currentPlan.isSubscribed,
        daysRemaining: currentPlan.daysRemaining,
        mockLimit: currentPlan.plan.mockLimit,
        mocksUsed: fixtureMocksUsedCount(data),
      }
    : undefined;

  return (
    <div className={inter.variable}>
      <PortalShell
        candidate={data.candidate}
        enrollments={data.enrollments}
        challengeTotalDays={data.challenge.totalDays}
        unreadNotifications={unreadNotifications}
        navSections={data.navSections}
        simplifiedMenu={simplifiedMenu}
        planWidget={planWidget}
      >
        {children}
      </PortalShell>
    </div>
  );
}
