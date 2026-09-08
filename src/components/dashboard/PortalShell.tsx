'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { CandidateProfile, ExamEnrollment, NavSection } from '@/dashboard/types';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './PortalShell.module.css';

export interface PortalShellProps {
  candidate: CandidateProfile;
  enrollments: ExamEnrollment[];
  challengeTotalDays: number;
  unreadNotifications: number;
  navSections: NavSection[];
  children: ReactNode;
}

/**
 * The persistent chrome around every candidate-portal screen: the grouped
 * sidebar and the exam/streak/profile topbar. Only `/dashboard` itself is a
 * real route today — the other nav items are wired to their planned URLs
 * (see `sdd/dashboard.md` Phase 5) so they highlight correctly once built,
 * but nothing renders behind them yet.
 */
export function PortalShell({
  candidate,
  enrollments,
  challengeTotalDays,
  unreadNotifications,
  navSections,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const primaryExam = enrollments.find((enrollment) => enrollment.isPrimary) ?? enrollments[0];
  const otherExams = enrollments.filter((enrollment) => enrollment !== primaryExam);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logoRow}>
          <div className={styles.logoMark}>M</div>
          <div>
            <div className={styles.logoName}>Mocksathi</div>
            <div className={styles.logoBy}>by TypingSathi</div>
          </div>
        </div>

        {navSections.map((section) => (
          <nav
            key={section.title ?? 'primary'}
            className={styles.navSection}
            aria-label={section.title ?? 'Dashboard'}
          >
            {section.title && <div className={styles.navSectionTitle}>{section.title}</div>}
            {section.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
                  aria-current={active ? 'page' : undefined}
                >
                  <DashboardIcon name={item.icon} size={17} />
                  {item.label}
                  {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
                </Link>
              );
            })}
          </nav>
        ))}
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.examPicker}>
            <div className={styles.examPickerButton}>
              {primaryExam?.examName}
              <DashboardIcon name="chevron-down" size={14} />
            </div>
            {otherExams.length > 0 && (
              <div className={styles.alsoEnrolled}>
                also enrolled:
                {otherExams.map((exam) => (
                  <span key={exam.examId} className={styles.enrolledChip}>
                    {exam.examName}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.topbarRight}>
            <div className={styles.streakBadge}>
              <DashboardIcon name="flame" size={16} />
              {challengeTotalDays} Day Streak
            </div>
            <button type="button" className={styles.bellButton} aria-label="Notifications">
              <DashboardIcon name="bell" size={18} />
              {unreadNotifications > 0 && <span className={styles.bellDot}>{unreadNotifications}</span>}
            </button>
            <div className={styles.userChip}>
              <div className={styles.avatar}>{candidate.initials}</div>
              <div>
                <div className={styles.userName}>{candidate.name}</div>
                <div className={styles.userRole}>{candidate.role}</div>
              </div>
            </div>
          </div>
        </header>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
