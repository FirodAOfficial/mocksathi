import { requireUser } from '@/auth/cookies';
import { CalendarScreen } from '@/components/dashboard/CalendarScreen';
import { dashboardDataFor } from '@/dashboard/seedDashboard';

export default async function MockCalendarPage() {
  const user = await requireUser();
  const data = dashboardDataFor(user);

  return (
    <CalendarScreen
      monthLabel={data.calendarMonthLabel}
      challenge={data.challenge}
      days={data.calendarDays}
      streak={data.streak}
      todaysMock={data.todaysMock}
    />
  );
}
