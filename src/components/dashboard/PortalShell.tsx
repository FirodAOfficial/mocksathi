'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CandidateProfile, ExamEnrollment, NavSection } from '@/dashboard/types';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './PortalShell.module.css';

const LOGOUT_HREF = '/logout';

export interface PortalShellProps {
  candidate: CandidateProfile;
  enrollments: ExamEnrollment[];
  challengeTotalDays: number;
  unreadNotifications: number;
  navSections: NavSection[];
  /** The simplified menu has far fewer items than the full one — sized up so it doesn't look sparse in a full-height sidebar. */
  simplifiedMenu?: boolean;
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
  simplifiedMenu = false,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const primaryExam = enrollments.find((enrollment) => enrollment.isPrimary) ?? enrollments[0];
  const otherExams = enrollments.filter((enrollment) => enrollment !== primaryExam);

  useEffect(() => {
    if (!userMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setUserMenuOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  const iconSize = simplifiedMenu ? 20 : 17;

  return (
    <div className={styles.shell}>
      <aside className={simplifiedMenu ? `${styles.sidebar} ${styles.sidebarSpacious}` : styles.sidebar}>
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
              if (item.href === LOGOUT_HREF) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    className={styles.navButton}
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    <DashboardIcon name={item.icon} size={iconSize} />
                    {loggingOut ? 'Logging out…' : item.label}
                  </button>
                );
              }

              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
                  aria-current={active ? 'page' : undefined}
                >
                  <DashboardIcon name={item.icon} size={iconSize} />
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
            <div className={styles.userMenu} ref={userMenuRef}>
              <button
                type="button"
                className={styles.userChip}
                onClick={() => setUserMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <div className={styles.avatar}>{candidate.initials}</div>
                <div className={styles.userText}>
                  <div className={styles.userName}>{candidate.name}</div>
                  <div className={styles.userRole}>{candidate.role}</div>
                </div>
                <DashboardIcon name="chevron-down" size={14} />
              </button>

              {userMenuOpen && (
                <div className={styles.userMenuPanel} role="menu">
                  <Link
                    href="/dashboard/profile"
                    role="menuitem"
                    className={styles.userMenuItem}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <DashboardIcon name="user" size={16} />
                    Profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.userMenuItem}
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    <DashboardIcon name="log-out" size={16} />
                    {loggingOut ? 'Logging out…' : 'Logout'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
