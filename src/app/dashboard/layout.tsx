import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { requireVerifiedUser } from '@/auth/cookies';
import { PortalShell, type PlanWidgetData } from '@/components/dashboard/PortalShell';
import { dashboardDataFor } from '@/dashboard/seedDashboard';
import { attemptedTestCountForUser } from '@/db/attempts';
import { availableExamsForUser } from '@/db/enrollments';
import { currentPlanForUser } from '@/db/plans';

const inter = Inter({ subsets: ['latin'], variable: '--db-font' });

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Track streaks, mocks, and performance for your target exam.',
  // Everything under here needs a session; a crawler only ever sees the
  // redirect to /login.
  robots: { index: false, follow: false },
};

/**
 * Shared chrome for every candidate-portal route under `/dashboard`.
 *
 * The candidate portal is a distinct visual product from the document editor
 * at `/editor` (Inter, card-based, `#1c6ef2` accent vs. the Office chrome in
 * `globals.css`), so its font and shell are scoped here rather than touching
 * the root layout. `requireVerifiedUser` sends a signed-out visitor to `/login`
 * before anything here renders.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireVerifiedUser();
  const simplifiedMenu = user.role !== 'admin';

  const [data, currentPlan, mocksUsed] = await Promise.all([
    dashboardDataFor(user),
    // Only the simplified menu shows the plan widget — skip the query for admins.
    simplifiedMenu ? currentPlanForUser(user.id) : Promise.resolve(null),
    simplifiedMenu ? attemptedTestCountForUser(user.id) : Promise.resolve(0),
  ]);
  const unreadNotifications = data.notifications.filter((notification) => !notification.read).length;

  // Only fetched for the candidates who'd actually see the prompt — an
  // admin, or anyone who already has a target exam, costs nothing extra.
  const needsExamPrompt = simplifiedMenu && data.enrollments.length === 0;
  const availableExams = needsExamPrompt ? await availableExamsForUser(user.id) : [];

  const planWidget: PlanWidgetData | undefined = currentPlan
    ? {
        planName: currentPlan.plan.name,
        isSubscribed: currentPlan.isSubscribed,
        daysRemaining: currentPlan.daysRemaining,
        mockLimit: currentPlan.plan.mockLimit,
        mocksUsed,
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
        hasCompletedTour={user.tourCompletedAt !== null}
        availableExams={availableExams.map((exam) => ({ id: exam.id, name: exam.name, category: exam.category }))}
      >
        {children}
      </PortalShell>
    </div>
  );
}
