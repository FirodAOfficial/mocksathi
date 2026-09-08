import 'server-only';
import { enrollmentsForUser } from '@/db/enrollments';
import type { DashboardData, ExamEnrollment, NavSection } from './types';

/**
 * The dashboard's fixture data.
 *
 * Lifted from the approved mockup (`design/Quiz website UI mockups.zip`,
 * screens `1f`–`1h`: Aman Verma, SSC CGL 2025, mock 19 of a 30-day challenge)
 * so the built screen can be checked figure-for-figure against the design.
 * `DashboardScreen` takes a `DashboardData` and draws it with no knowledge of
 * where it came from; a real API response replaces this wholesale once one
 * exists, same as `SEED_ATTEMPT` in `src/exam/seedAttempt.ts`.
 */
export const SEED_DASHBOARD: DashboardData = {
  candidate: {
    name: 'Aman Verma',
    initials: 'AV',
    role: 'Student',
  },
  enrollments: [
    { examId: 'ssc-cgl-2025', examName: 'SSC CGL 2025', isPrimary: true },
    { examId: 'ibps-po-2025', examName: 'IBPS PO 2025', isPrimary: false },
    { examId: 'rrb-ntpc-2025', examName: 'RRB NTPC 2025', isPrimary: false },
  ],
  streak: {
    currentStreakDays: 18,
    lockHour: 21,
    lastMissedDate: '19 Sep',
  },
  challenge: {
    name: '30 Days Challenge',
    totalDays: 30,
    completedDays: 18,
    totalMarks: 2670,
    maxMarks: 6000,
    missedDays: 1,
  },
  calendarMonthLabel: 'September 2026',
  calendarDays: [
    { day: 17, status: 'attempted', mockLabel: 'M13', note: '149' },
    { day: 18, status: 'attempted', mockLabel: 'M14', note: '144' },
    { day: 19, status: 'missed' },
    { day: 20, status: 'attempted', mockLabel: 'M15', note: '152' },
    { day: 21, status: 'attempted', mockLabel: 'M16', note: '149' },
    { day: 22, status: 'attempted', mockLabel: 'M17', note: '153' },
    { day: 23, status: 'attempted', mockLabel: 'M18', note: '151' },
    { day: 24, status: 'today', mockLabel: 'M19', note: '60 min' },
    { day: 25, status: 'locked', mockLabel: 'M20' },
    { day: 26, status: 'locked', mockLabel: 'M21' },
    { day: 27, status: 'locked', mockLabel: 'M22' },
    { day: 28, status: 'locked', mockLabel: 'M23' },
    { day: 29, status: 'locked', mockLabel: 'M24' },
    { day: 30, status: 'upcoming', note: 'Full revision' },
  ],
  todaysMock: {
    mockNumber: 19,
    paperName: 'Tier 1 Full Length · 100 Qs',
    state: 'today',
    dateLabel: '24 Sep',
    timeSpentSeconds: 60 * 60,
  },
  recentMocks: [
    {
      mockNumber: 18,
      paperName: 'Tier 1 Full Length · 100 Qs',
      state: 'done',
      score: 151.0,
      maxScore: 200,
      accuracyPct: 86,
      rank: 2104,
      timeSpentSeconds: 57 * 60 + 40,
      dateLabel: '23 Sep',
    },
    {
      mockNumber: 17,
      paperName: 'Tier 1 Full Length · 100 Qs',
      state: 'done',
      score: 153.0,
      maxScore: 200,
      accuracyPct: 88,
      rank: 1988,
      timeSpentSeconds: 55 * 60 + 12,
      dateLabel: '22 Sep',
    },
    {
      mockNumber: 16,
      paperName: 'Tier 1 Full Length · 100 Qs',
      state: 'done',
      score: 149.0,
      maxScore: 200,
      accuracyPct: 85,
      rank: 2260,
      timeSpentSeconds: 58 * 60 + 3,
      dateLabel: '21 Sep',
    },
    {
      mockNumber: 15,
      paperName: 'Tier 1 Full Length · 100 Qs',
      state: 'done',
      score: 172.0,
      maxScore: 200,
      accuracyPct: 92,
      rank: 1142,
      timeSpentSeconds: 53 * 60 + 47,
      dateLabel: '20 Sep',
      isBestScore: true,
    },
    {
      mockNumber: 20,
      paperName: 'Tier 1 Full Length · 100 Qs',
      state: 'locked',
      dateLabel: '25 Sep',
      unlockNote: 'Unlocks after you complete Mock 19',
    },
  ],
  // Every mock 1–30. 19 Sep has no row: that's the missed day on the
  // calendar, so mock numbering resumes at 15 on 20 Sep rather than 14b.
  allMocks: [
    { mockNumber: 1, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 118.0, maxScore: 200, accuracyPct: 62, rank: 4820, timeSpentSeconds: 58 * 60 + 40, dateLabel: '5 Sep' },
    { mockNumber: 2, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 122.0, maxScore: 200, accuracyPct: 64, rank: 4530, timeSpentSeconds: 57 * 60 + 12, dateLabel: '6 Sep' },
    { mockNumber: 3, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 126.0, maxScore: 200, accuracyPct: 67, rank: 4210, timeSpentSeconds: 56 * 60 + 48, dateLabel: '7 Sep' },
    { mockNumber: 4, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 120.0, maxScore: 200, accuracyPct: 63, rank: 4460, timeSpentSeconds: 59 * 60 + 3, dateLabel: '8 Sep' },
    { mockNumber: 5, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 131.0, maxScore: 200, accuracyPct: 70, rank: 3890, timeSpentSeconds: 55 * 60 + 37, dateLabel: '9 Sep' },
    { mockNumber: 6, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 135.0, maxScore: 200, accuracyPct: 72, rank: 3640, timeSpentSeconds: 54 * 60 + 52, dateLabel: '10 Sep' },
    { mockNumber: 7, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 129.0, maxScore: 200, accuracyPct: 69, rank: 3910, timeSpentSeconds: 56 * 60 + 15, dateLabel: '11 Sep' },
    { mockNumber: 8, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 138.0, maxScore: 200, accuracyPct: 74, rank: 3400, timeSpentSeconds: 53 * 60 + 48, dateLabel: '12 Sep' },
    { mockNumber: 9, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 141.0, maxScore: 200, accuracyPct: 76, rank: 3180, timeSpentSeconds: 54 * 60 + 2, dateLabel: '13 Sep' },
    { mockNumber: 10, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 136.0, maxScore: 200, accuracyPct: 73, rank: 3350, timeSpentSeconds: 55 * 60 + 20, dateLabel: '14 Sep' },
    { mockNumber: 11, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 144.0, maxScore: 200, accuracyPct: 78, rank: 2980, timeSpentSeconds: 52 * 60 + 55, dateLabel: '15 Sep' },
    { mockNumber: 12, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 147.0, maxScore: 200, accuracyPct: 80, rank: 2790, timeSpentSeconds: 53 * 60 + 10, dateLabel: '16 Sep' },
    { mockNumber: 13, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 149.0, maxScore: 200, accuracyPct: 81, rank: 2650, timeSpentSeconds: 54 * 60 + 30, dateLabel: '17 Sep' },
    { mockNumber: 14, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 144.0, maxScore: 200, accuracyPct: 79, rank: 2820, timeSpentSeconds: 55 * 60 + 48, dateLabel: '18 Sep' },
    { mockNumber: 15, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 172.0, maxScore: 200, accuracyPct: 92, rank: 1142, timeSpentSeconds: 53 * 60 + 47, dateLabel: '20 Sep', isBestScore: true },
    { mockNumber: 16, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 149.0, maxScore: 200, accuracyPct: 85, rank: 2260, timeSpentSeconds: 58 * 60 + 3, dateLabel: '21 Sep' },
    { mockNumber: 17, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 153.0, maxScore: 200, accuracyPct: 88, rank: 1988, timeSpentSeconds: 55 * 60 + 12, dateLabel: '22 Sep' },
    { mockNumber: 18, paperName: 'Tier 1 Full Length · 100 Qs', state: 'done', score: 151.0, maxScore: 200, accuracyPct: 86, rank: 2104, timeSpentSeconds: 57 * 60 + 40, dateLabel: '23 Sep' },
    { mockNumber: 19, paperName: 'Tier 1 Full Length · 100 Qs', state: 'today', dateLabel: '24 Sep', timeSpentSeconds: 60 * 60 },
    { mockNumber: 20, paperName: 'Tier 1 Full Length · 100 Qs', state: 'locked', dateLabel: '25 Sep', unlockNote: 'Unlocks after you complete Mock 19' },
    { mockNumber: 21, paperName: 'Tier 1 Full Length · 100 Qs', state: 'locked', dateLabel: '26 Sep', unlockNote: 'Unlocks after you complete Mock 20' },
    { mockNumber: 22, paperName: 'Tier 1 Full Length · 100 Qs', state: 'locked', dateLabel: '27 Sep', unlockNote: 'Unlocks after you complete Mock 21' },
    { mockNumber: 23, paperName: 'Tier 1 Full Length · 100 Qs', state: 'locked', dateLabel: '28 Sep', unlockNote: 'Unlocks after you complete Mock 22' },
    { mockNumber: 24, paperName: 'Tier 1 Full Length · 100 Qs', state: 'locked', dateLabel: '29 Sep', unlockNote: 'Unlocks after you complete Mock 23' },
    { mockNumber: 25, paperName: 'Full Revision · Cumulative', state: 'locked', dateLabel: '30 Sep', unlockNote: 'Unlocks after you complete Mock 24' },
    { mockNumber: 26, paperName: 'Tier 1 Full Length · 100 Qs', state: 'locked', dateLabel: '1 Oct', unlockNote: 'Unlocks after you complete Mock 25' },
    { mockNumber: 27, paperName: 'Tier 1 Full Length · 100 Qs', state: 'locked', dateLabel: '2 Oct', unlockNote: 'Unlocks after you complete Mock 26' },
    { mockNumber: 28, paperName: 'Tier 1 Full Length · 100 Qs', state: 'locked', dateLabel: '3 Oct', unlockNote: 'Unlocks after you complete Mock 27' },
    { mockNumber: 29, paperName: 'Tier 1 Full Length · 100 Qs', state: 'locked', dateLabel: '4 Oct', unlockNote: 'Unlocks after you complete Mock 28' },
    { mockNumber: 30, paperName: 'Full Revision · Cumulative', state: 'locked', dateLabel: '5 Oct', unlockNote: 'Unlocks after you complete Mock 29' },
  ],
  performance: {
    averageScore: 148.3,
    maxScore: 200,
    scoreDeltaVsLastWeek: 14,
    accuracyPct: 86.3,
    accuracyDeltaPts: 2.1,
    attemptRatePct: 94.5,
    bestPercentile: 92.1,
    bestPercentileMockNumber: 19,
    bestPercentileRank: 1904,
  },
  subjects: [
    {
      subject: 'Reasoning',
      avgMarks: 40.2,
      maxMarks: 50,
      accuracyPct: 88,
      avgTimeSeconds: 13 * 60 + 10,
      benchmarkPct: 88,
      color: '#2563eb',
    },
    {
      subject: 'General Knowledge',
      avgMarks: 32.4,
      maxMarks: 50,
      accuracyPct: 74,
      avgTimeSeconds: 10 * 60 + 40,
      benchmarkPct: 86,
      color: '#16a34a',
    },
    {
      subject: 'Mathematics',
      avgMarks: 35.8,
      maxMarks: 50,
      accuracyPct: 76,
      avgTimeSeconds: 18 * 60 + 5,
      benchmarkPct: 90,
      color: '#f97316',
    },
    {
      subject: 'English',
      avgMarks: 43.6,
      maxMarks: 50,
      accuracyPct: 96,
      avgTimeSeconds: 11 * 60 + 20,
      benchmarkPct: 92,
      color: '#7c3aed',
    },
  ],
  weakAreas: [
    {
      topic: 'Coding — Decoding',
      subject: 'Reasoning',
      priority: 'High',
      avgMarks: 9,
      maxMarks: 50,
      accuracyPct: 38,
      attempts: 2,
      lastPracticedLabel: '6 days ago',
    },
    {
      topic: 'Blood Relation',
      subject: 'Reasoning',
      priority: 'High',
      avgMarks: 12,
      maxMarks: 50,
      accuracyPct: 42,
      attempts: 3,
      lastPracticedLabel: '2 days ago',
    },
    {
      topic: 'Polity — Fundamental Rights',
      subject: 'General Knowledge',
      priority: 'High',
      avgMarks: 11,
      maxMarks: 50,
      accuracyPct: 45,
      attempts: 2,
      lastPracticedLabel: '5 days ago',
    },
  ],
  strongAreas: [
    { topic: 'Reading Comprehension', masteryPct: 98 },
    { topic: 'Synonyms & Antonyms', masteryPct: 96 },
    { topic: 'Series Completion', masteryPct: 94 },
  ],
  notifications: [
    { id: 'n1', message: 'Mock 19 unlocks today — keep your streak alive.', whenLabel: '2h ago', read: false },
    { id: 'n2', message: 'Your Mock 18 solutions are ready to review.', whenLabel: '1d ago', read: false },
    { id: 'n3', message: 'New Previous Year Paper added: SSC CGL 2024 Tier 1.', whenLabel: '2d ago', read: false },
  ],
  // The full menu — admins get this (plus the Admin section `dashboardDataFor`
  // appends); everyone else gets `SIMPLIFIED_NAV_SECTIONS` below.
  navSections: [
    { items: [{ label: 'Dashboard', icon: 'layout-dashboard', href: '/dashboard' }] },
    {
      title: 'Mocks',
      items: [
        { label: 'Mock Calendar', icon: 'calendar-days', href: '/dashboard/calendar' },
        { label: 'All Mocks (1–30)', icon: 'layers', href: '/dashboard/mocks' },
        { label: 'Performance', icon: 'bar-chart-3', href: '/dashboard/performance' },
        { label: 'Previous Mocks', icon: 'history', href: '/dashboard/mocks/previous' },
        { label: 'Compare Performance', icon: 'git-compare', href: '/dashboard/compare' },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Profile & Settings', icon: 'user', href: '/dashboard/profile' },
        { label: 'Help & Support', icon: 'circle-help', href: '/dashboard/help' },
        { label: 'Logout', icon: 'log-out', href: '/logout' },
      ],
    },
  ],
};

/**
 * The menu everyone who isn't an admin sees — flat, no section headers,
 * matching the simplified reference design (Dashboard / My Tests /
 * Performance / Help & Support / Share). Logout and Profile live in the
 * topbar's user menu (`PortalShell`) instead, matching that reference too.
 */
export const SIMPLIFIED_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', icon: 'home', href: '/dashboard' },
      { label: 'My Tests', icon: 'layers', href: '/dashboard/mocks' },
      { label: 'Performance', icon: 'bar-chart-3', href: '/dashboard/performance' },
      { label: 'Help & Support', icon: 'circle-help', href: '/dashboard/help' },
      { label: 'Share', icon: 'share', href: '/dashboard/share' },
    ],
  },
];

/** `2670` -> `"2,670"`. */
export function formatMarks(value: number): string {
  return Math.round(value).toLocaleString('en-IN');
}

/** `3661` -> `"61:01"`. Minutes are not clamped to 60, matching the mocks table. */
export function formatMinutesSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Percent of challenge days completed, rounded to the nearest whole percent. */
export function challengeProgressPct(challenge: DashboardData['challenge']): number {
  return Math.round((challenge.completedDays / challenge.totalDays) * 100);
}

/**
 * Hours and minutes until the streak locks for the day, e.g. `"11h 18m left"`.
 *
 * The streak locks at `lockHour` (24-hour clock) each day; once that has
 * passed for `now`, it reports the time left until the same hour tomorrow.
 */
export function streakLockCountdownLabel(lockHour: number, now: Date): string {
  const lock = new Date(now);
  lock.setHours(lockHour, 0, 0, 0);
  if (lock.getTime() <= now.getTime()) {
    lock.setDate(lock.getDate() + 1);
  }
  const remainingMinutes = Math.round((lock.getTime() - now.getTime()) / 60000);
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return `${hours}h ${minutes}m left`;
}

/** `"Aman Verma"` -> `"AV"`, `"Cher"` -> `"C"`. */
export function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
  return initials || '?';
}

/**
 * `SEED_DASHBOARD` with the signed-in candidate's real name in place of the
 * fixture's, and a role-appropriate nav: admins get the full menu (plus an
 * "Admin" section), everyone else gets `SIMPLIFIED_NAV_SECTIONS`. Everything
 * else — mocks, streak, analysis — stays fixture data until the dashboard
 * itself reads from the database (`sdd/dashboard.md` Phase 6); this just
 * keeps the things every page shows (who you are, what you can reach)
 * honest now that `/dashboard` sits behind a real login with roles
 * (`sdd/exams.md`).
 *
 * Async as of the `enrollments` table: exam registrations are real data now
 * (`src/db/enrollments.ts`), not fixture — this is the one field on
 * `DashboardData` that genuinely comes from the database for every caller,
 * rather than being fixture with the odd real field overlaid.
 */
export async function dashboardDataFor(identity: { id: string; name: string; role: string }): Promise<DashboardData> {
  const navSections: NavSection[] =
    identity.role === 'admin'
      ? [
          ...SEED_DASHBOARD.navSections,
          {
            title: 'Admin',
            items: [{ label: 'Manage Exams', icon: 'shield' as const, href: '/dashboard/admin/exams' }],
          },
        ]
      : SIMPLIFIED_NAV_SECTIONS;

  const dbEnrollments = await enrollmentsForUser(identity.id);
  const enrollments: ExamEnrollment[] = dbEnrollments.map((enrollment) => ({
    examId: enrollment.exam.id,
    examName: enrollment.exam.name,
    isPrimary: enrollment.isPrimary,
  }));

  return {
    ...SEED_DASHBOARD,
    candidate: { ...SEED_DASHBOARD.candidate, name: identity.name, initials: initialsFor(identity.name) },
    navSections,
    enrollments,
  };
}
