/**
 * The student product tour's content and route, pure data so `StudentTour`
 * only has to walk it.
 *
 * Each step names a `page` (client-side navigated to if the tour isn't
 * already there) and a `selector` — matched against a `data-tour="<id>"`
 * attribute already sitting on the real element, not a purpose-built one, so
 * the tour breaks visibly (wrong highlight) rather than silently if that
 * element is ever restructured.
 */

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  id: string;
  page: string;
  selector: string;
  title: string;
  body: string;
  placement: TourPlacement;
}

export const STUDENT_TOUR_STEPS: TourStep[] = [
  {
    id: 'nav',
    page: '/dashboard',
    selector: '[data-tour="nav-sidebar"]',
    title: 'Your navigation',
    body: 'Dashboard, mocks, performance and your profile are always one click away here.',
    placement: 'right',
  },
  {
    id: 'performance-overview',
    page: '/dashboard',
    selector: '[data-tour="performance-overview"]',
    title: 'Your performance at a glance',
    body: 'A quick read on your average score and accuracy — tap "View Detailed Analysis" any time for the full breakdown.',
    placement: 'bottom',
  },
  {
    id: 'dashboard-mocks',
    page: '/dashboard',
    selector: '[data-tour="dashboard-mocks"]',
    title: 'Your mocks',
    body: 'Every mock you can attempt shows up here, filterable by Word or Excel.',
    placement: 'top',
  },
  {
    id: 'todays-mock',
    page: '/dashboard/mocks',
    selector: '[data-tour="todays-mock"]',
    title: "Today's mock",
    body: "This is the one to attempt today — tap it to read the instructions and start.",
    placement: 'bottom',
  },
  {
    id: 'performance-detail',
    page: '/dashboard/performance',
    selector: '[data-tour="performance-detail"]',
    title: 'Detailed analysis',
    body: 'Scores, accuracy and attempt rate across your recent mocks, broken down by subject.',
    placement: 'bottom',
  },
  {
    id: 'profile',
    page: '/dashboard/profile',
    selector: '[data-tour="profile-account"]',
    title: 'Your account',
    body: 'Update your name, photo, exam registrations, and password here whenever you need to.',
    placement: 'bottom',
  },
];
