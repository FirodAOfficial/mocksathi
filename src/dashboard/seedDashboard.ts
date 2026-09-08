import type { DashboardData } from './types';

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
  navSections: [
    { items: [{ label: 'Dashboard', icon: 'layout-dashboard', href: '/dashboard' }] },
    {
      title: 'Mocks',
      items: [
        { label: "Today's Mock", icon: 'file-check-2', href: '/dashboard/today', badge: '1' },
        { label: 'Mock Calendar', icon: 'calendar-days', href: '/dashboard/calendar' },
        { label: 'All Mocks (1–30)', icon: 'layers', href: '/dashboard/mocks' },
        { label: 'Performance', icon: 'bar-chart-3', href: '/dashboard/performance' },
        { label: 'Previous Mocks', icon: 'history', href: '/dashboard/mocks/previous' },
        { label: 'Compare Performance', icon: 'git-compare', href: '/dashboard/compare' },
      ],
    },
    {
      title: 'Analytics',
      items: [
        { label: 'Overall Analysis', icon: 'pie-chart', href: '/dashboard/analysis' },
        { label: 'Subject Analysis', icon: 'book-open-check', href: '/dashboard/analysis/subject' },
        { label: 'Topic Analysis', icon: 'git-branch', href: '/dashboard/analysis/topic' },
        { label: 'Weak Areas', icon: 'trending-down', href: '/dashboard/weak-areas' },
        { label: 'Strong Areas', icon: 'star', href: '/dashboard/strong-areas' },
      ],
    },
    {
      title: 'Study tools',
      items: [
        { label: 'Practice Zone', icon: 'dumbbell', href: '/dashboard/practice' },
        { label: 'Topic Tests', icon: 'list-checks', href: '/dashboard/practice/topic-tests' },
        { label: 'Previous Year Papers', icon: 'files', href: '/dashboard/papers' },
        { label: 'Bookmarks', icon: 'bookmark', href: '/dashboard/bookmarks' },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Profile', icon: 'user', href: '/dashboard/profile' },
        { label: 'Settings', icon: 'settings', href: '/dashboard/settings' },
        { label: 'Help & Support', icon: 'circle-help', href: '/dashboard/help' },
        { label: 'Logout', icon: 'log-out', href: '/logout' },
      ],
    },
  ],
};

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
