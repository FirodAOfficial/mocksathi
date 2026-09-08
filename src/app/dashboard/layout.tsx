import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { PortalShell } from '@/components/dashboard/PortalShell';
import { SEED_DASHBOARD } from '@/dashboard/seedDashboard';

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
 * the root layout.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const data = SEED_DASHBOARD;
  const unreadNotifications = data.notifications.filter((notification) => !notification.read).length;

  return (
    <div className={inter.variable}>
      <PortalShell
        candidate={data.candidate}
        enrollments={data.enrollments}
        challengeTotalDays={data.challenge.totalDays}
        unreadNotifications={unreadNotifications}
        navSections={data.navSections}
      >
        {children}
      </PortalShell>
    </div>
  );
}
