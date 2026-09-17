'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrandLogo } from '@/components/site/BrandLogo';
import type { CandidateProfile, ExamEnrollment, NavSection } from '@/dashboard/types';
import { PortalFooter } from './PortalFooter';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './PortalShell.module.css';
import { SelectExamModal, type SelectExamOption } from './SelectExamModal';
import { StudentTour } from './tour/StudentTour';

const LOGOUT_HREF = '/logout';

export interface PlanWidgetData {
  planName: string;
  isSubscribed: boolean;
  daysRemaining: number | null;
  mockLimit: number | null;
  mocksUsed: number;
}

export interface PortalShellProps {
  candidate: CandidateProfile;
  enrollments: ExamEnrollment[];
  challengeTotalDays: number;
  unreadNotifications: number;
  navSections: NavSection[];
  /** The simplified menu has far fewer items than the full one — sized up so it doesn't look sparse in a full-height sidebar. */
  simplifiedMenu?: boolean;
  /** The sidebar's bottom plan widget — shown only alongside `simplifiedMenu` (admins don't need it), and only once a default plan exists to fall back to. */
  planWidget?: PlanWidgetData;
  /** Whether this candidate has finished (or skipped) the student tour — `false` auto-starts it on mount. */
  hasCompletedTour?: boolean;
  /** Published exams the candidate hasn't registered for yet. Non-empty only when they have no exam at all — see `dashboard/layout.tsx`. */
  availableExams?: SelectExamOption[];
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
  planWidget,
  hasCompletedTour = true,
  availableExams = [],
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Auto-starts once per account (the DB flag), not once per mount — a
  // full-page reload mid-tour, before it's finished or skipped, shows it
  // again, which reads as "you haven't gotten through this yet" rather than
  // a bug.
  // Same "once per session, not once ever" reasoning as `tourOpen` below —
  // shown again on the next full load if still dismissed without picking
  // one, but not re-popped by every client-side navigation within this
  // session.
  const [examModalOpen, setExamModalOpen] = useState(() => availableExams.length > 0);
  // Doesn't auto-start alongside the exam prompt — two modals stacked on a
  // brand-new account's very first load would be a lot at once. It opens
  // right after that one closes instead (`handleExamModalClose`) if it still
  // needs to.
  const [tourOpen, setTourOpen] = useState(() => !hasCompletedTour && !examModalOpen);
  const userMenuRef = useRef<HTMLDivElement>(null);
  // React's own documented pattern for "adjusting state when a prop
  // changes" without an effect — a ref would trip this project's
  // react-hooks/refs rule (no ref reads/writes during render), so this
  // tracks the same thing in state instead, which React explicitly permits
  // to set conditionally mid-render.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (mobileNavOpen) setMobileNavOpen(false);
  }

  // A Google-hosted photo (`candidate.avatarUrl`) is a URL this app doesn't
  // control — if it 404s (Google changes its scheme, the link expires,
  // whatever), the browser fires `onError` rather than rendering a blank
  // image, and this falls back to the initials circle instead of nothing.
  // Same render-time-reset pattern as `lastPathname` above, so a real photo
  // change (uploading a new one) clears a stale broken-flag from the old one.
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [lastAvatarUrl, setLastAvatarUrl] = useState(candidate.avatarUrl);
  if (candidate.avatarUrl !== lastAvatarUrl) {
    setLastAvatarUrl(candidate.avatarUrl);
    if (avatarBroken) setAvatarBroken(false);
  }
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

  useEffect(() => {
    if (!mobileNavOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileNavOpen(false);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileNavOpen]);

  function handleExamModalClose() {
    setExamModalOpen(false);
    if (!hasCompletedTour) setTourOpen(true);
  }

  function handleTourClose() {
    setTourOpen(false);
    // Fire-and-forget: marks it seen so it never auto-starts again. Safe to
    // call even when it was already marked (replayed via "Take a tour") —
    // the route is idempotent.
    void fetch('/api/profile/tour', { method: 'POST' });
  }

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

  // The result and worked-solutions screens (their own dense, two-column
  // design) get the full width instead — the topbar (exam picker, streak,
  // profile) stays, since it costs nothing and keeps "where am I" answered,
  // but the nav sidebar is exactly the space a candidate is there to spend
  // reading their answers, not navigating away.
  const hideSidebar = pathname.startsWith('/dashboard/mocks/test/');

  const sidebarClassName = [
    styles.sidebar,
    simplifiedMenu ? styles.sidebarSpacious : '',
    mobileNavOpen ? styles.sidebarOpen : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.shell}>
      {mobileNavOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/*
        A full-width strip above the sidebar/content split below it, not
        inside `.main` — it carries the logo now (`.topbarLogo`), so it reads
        as the page's own header rather than something that belongs beside
        the nav. That's also what lets the sidebar disappear entirely on some
        routes (`hideSidebar`) without the topbar's own layout changing shape.
      */}
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.topbarLogo} aria-label="Mocksathi dashboard">
          {/* Full lockup on desktop, mark only below 900px (`.topbarLogoFull`/
              `.topbarLogoCompact` toggle which of these shows) — the
              wordmark is the first thing worth giving up for room on a phone
              topbar that also carries the menu button and the exam picker. */}
          <span className={styles.topbarLogoFull}>
            <BrandLogo tone="dark" size={26} />
          </span>
          <span className={styles.topbarLogoCompact}>
            <BrandLogo tone="dark" size={24} markOnly />
          </span>
        </Link>

        {!hideSidebar && (
          <button
            type="button"
            className={styles.menuButton}
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <DashboardIcon name={mobileNavOpen ? 'x' : 'menu'} size={20} />
          </button>
        )}

        <div className={styles.examPicker}>
          {primaryExam ? (
            <div className={styles.examPickerButton}>
              <span className={styles.examPickerLabel}>{primaryExam.examName}</span>
              <DashboardIcon name="chevron-down" size={14} />
            </div>
          ) : (
            <Link href="/dashboard/profile" className={styles.examPickerButton}>
              + Add your exam
            </Link>
          )}
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
            <span className={styles.streakLabel}>{challengeTotalDays} Day Streak</span>
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
              {candidate.avatarUrl && !avatarBroken ? (
                // eslint-disable-next-line @next/next/no-img-element -- a per-user Supabase Storage/Google URL, not one `next/image` can optimize meaningfully.
                <img
                  src={candidate.avatarUrl}
                  alt=""
                  className={styles.avatarImage}
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <div className={styles.avatar}>{candidate.initials}</div>
              )}
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
                {simplifiedMenu && (
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.userMenuItem}
                    onClick={() => {
                      setUserMenuOpen(false);
                      setTourOpen(true);
                    }}
                  >
                    <DashboardIcon name="circle-help" size={16} />
                    Take a tour
                  </button>
                )}
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

      <div className={styles.body}>
        {!hideSidebar && (
          <aside className={sidebarClassName} data-tour="nav-sidebar">
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

            {simplifiedMenu && planWidget && (
              <div className={styles.planWidget}>
                <div className={styles.planCard}>
                  <div className={styles.planCardHeading}>
                    <DashboardIcon name="star" size={14} />
                    {planWidget.planName}
                  </div>
                  {planWidget.isSubscribed ? (
                    <>
                      <p className={styles.planCardDetail}>
                        {planWidget.daysRemaining !== null
                          ? `${planWidget.daysRemaining} day${planWidget.daysRemaining === 1 ? '' : 's'} remaining`
                          : 'No expiry'}
                      </p>
                      <Link href="/dashboard/subscription" className={styles.planCtaMuted}>
                        Manage plan
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className={styles.planCardDetail}>
                        {planWidget.mockLimit !== null
                          ? `${Math.max(0, planWidget.mockLimit - planWidget.mocksUsed)} free mocks left`
                          : 'Unlimited mocks'}
                      </p>
                      {planWidget.mockLimit !== null && (
                        <>
                          <div className={styles.planTrack}>
                            <div
                              className={styles.planFill}
                              style={{
                                width: `${Math.min(100, (planWidget.mocksUsed / planWidget.mockLimit) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className={styles.planUsageLabel}>
                            {planWidget.mocksUsed}/{planWidget.mockLimit} used
                          </p>
                        </>
                      )}
                      <Link href="/dashboard/subscription" className={styles.planCta}>
                        Upgrade now
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}

        <div className={styles.main}>
          <div className={styles.content}>
            {children}

            {/*
              Inside the scroll container, not after it: `.content` is what
              scrolls, so a sibling footer would be pinned to the viewport and
              take a strip of every screen. Here it sits at the end of the page,
              which is where a footer belongs. An ordinary last flex child, not
              a full-bleed slot — `PortalFooter` is sized to sit inside the
              page's own padding like everything above it, not to bleed past it.
            */}
            <PortalFooter />
          </div>
        </div>
      </div>

      {simplifiedMenu && <StudentTour open={tourOpen} onClose={handleTourClose} />}
      {examModalOpen && <SelectExamModal exams={availableExams} onClose={handleExamModalClose} />}
    </div>
  );
}
