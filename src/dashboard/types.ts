/**
 * The data the candidate dashboard renders.
 *
 * Flat and self-contained, same spirit as `src/exam/result.ts`: the screen
 * takes one `DashboardData` and draws it, with no knowledge of where the
 * numbers came from. That is what lets a hardcoded fixture serve the screen
 * today and a real API response serve it later without the components
 * changing. A few types here (`WeakArea`, `StrongArea`, `NotificationItem`)
 * are sized for more than the home screen needs today, because the same
 * shapes will back the Weak & Strong Areas and notifications screens planned
 * for later — see `sdd/dashboard.md` Phase 5.
 */

export interface CandidateProfile {
  name: string;
  /** Shown in the avatar circle when there is no photo. */
  initials: string;
  role: string;
}

export interface ExamEnrollment {
  examId: string;
  examName: string;
  /** The exam shown selected in the topbar picker; exactly one is primary. */
  isPrimary: boolean;
}

/**
 * Progress on the candidate's running day-streak.
 *
 * `currentStreakDays` is what the streak card and calendar report today.
 * `lockHour` is the 24-hour clock hour the streak locks for the day (21 ->
 * "9:00 PM"), used to derive the countdown shown next to it.
 */
export interface StreakState {
  currentStreakDays: number;
  lockHour: number;
  lastMissedDate: string;
}

export interface ChallengePlan {
  name: string;
  totalDays: number;
  completedDays: number;
  totalMarks: number;
  maxMarks: number;
  missedDays: number;
}

export type MockCalendarDayStatus = 'attempted' | 'missed' | 'today' | 'locked' | 'upcoming';

export interface MockCalendarDay {
  /** Day of month. */
  day: number;
  status: MockCalendarDayStatus;
  /** e.g. "M14", absent for days with no mock (the final "Full revision" day). */
  mockLabel?: string;
  /** e.g. "144" marks, or a status note like "Full revision". */
  note?: string;
}

export type MockState = 'done' | 'today' | 'missed' | 'locked';

/**
 * One row of the mocks list.
 *
 * Deliberately separate from `ExamResult` in `src/exam/result.ts`: that type
 * is what one finished attempt's result screen renders, this is what one row
 * of a *list* of attempts (finished or not) shows. A real backend will likely
 * derive one from the other, not merge them.
 */
export interface MockSummary {
  mockNumber: number;
  paperName: string;
  state: MockState;
  /** Absent until the mock is attempted. */
  score?: number;
  maxScore?: number;
  accuracyPct?: number;
  rank?: number;
  timeSpentSeconds?: number;
  /** Display label, e.g. "24 Sep" — the mockup does not carry a full date. */
  dateLabel: string;
  isBestScore?: boolean;
  /** Set only on the locked row that explains what unlocks it. */
  unlockNote?: string;
}

export interface PerformanceSnapshot {
  averageScore: number;
  maxScore: number;
  scoreDeltaVsLastWeek: number;
  accuracyPct: number;
  accuracyDeltaPts: number;
  attemptRatePct: number;
  bestPercentile: number;
  bestPercentileMockNumber: number;
  bestPercentileRank: number;
}

export interface SubjectSnapshot {
  subject: string;
  avgMarks: number;
  maxMarks: number;
  accuracyPct: number;
  avgTimeSeconds: number;
  /** Top-10% benchmark for this subject, as a percent of `maxMarks`. */
  benchmarkPct: number;
  /** CSS colour used for this subject's bar, consistent across screens. */
  color: string;
}

export type Priority = 'High' | 'Medium' | 'Low';

export interface WeakArea {
  topic: string;
  subject: string;
  priority: Priority;
  avgMarks: number;
  maxMarks: number;
  accuracyPct: number;
  attempts: number;
  lastPracticedLabel: string;
}

export interface StrongArea {
  topic: string;
  masteryPct: number;
}

export interface NotificationItem {
  id: string;
  message: string;
  /** Display label, e.g. "2h ago". */
  whenLabel: string;
  read: boolean;
}

export type NavIconName =
  | 'layout-dashboard'
  | 'file-check-2'
  | 'calendar-days'
  | 'layers'
  | 'bar-chart-3'
  | 'history'
  | 'git-compare'
  | 'pie-chart'
  | 'book-open-check'
  | 'git-branch'
  | 'trending-down'
  | 'star'
  | 'dumbbell'
  | 'list-checks'
  | 'files'
  | 'bookmark'
  | 'user'
  | 'settings'
  | 'circle-help'
  | 'log-out'
  | 'shield';

export interface NavItem {
  label: string;
  icon: NavIconName;
  href: string;
  /** A count badge, e.g. "1" on Today's Mock. Absent for most items. */
  badge?: string;
}

export interface NavSection {
  /** Absent for the ungrouped "Dashboard" item at the very top. */
  title?: string;
  items: NavItem[];
}

export interface DashboardData {
  candidate: CandidateProfile;
  enrollments: ExamEnrollment[];
  streak: StreakState;
  challenge: ChallengePlan;
  calendarMonthLabel: string;
  calendarDays: MockCalendarDay[];
  todaysMock: MockSummary;
  recentMocks: MockSummary[];
  /** Every mock in the 30-day challenge, 1 through 30 — the "All Mocks" page. */
  allMocks: MockSummary[];
  performance: PerformanceSnapshot;
  subjects: SubjectSnapshot[];
  weakAreas: WeakArea[];
  strongAreas: StrongArea[];
  notifications: NotificationItem[];
  navSections: NavSection[];
}
