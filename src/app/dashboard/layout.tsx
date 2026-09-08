import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { requireUser } from '@/auth/cookies';
import { PortalShell } from '@/components/dashboard/PortalShell';
import { dashboardDataFor } from '@/dashboard/seedDashboard';

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
  const data = dashboardDataFor(user);
  const unreadNotifications = data.notifications.filter((notification) => !notification.read).length;

  return (
    <div className={inter.variable}>
      <PortalShell
        candidate={data.candidate}
        enrollments={data.enrollments}
        challengeTotalDays={data.challenge.totalDays}
        unreadNotifications={unreadNotifications}
        navSections={data.navSections}
        simplifiedMenu={user.role !== 'admin'}
      >
        {children}
      </PortalShell>
    </div>
  );
}
