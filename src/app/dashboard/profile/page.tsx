import { requireUser } from '@/auth/cookies';
import { ProfileScreen } from '@/components/dashboard/ProfileScreen';
import { dashboardDataFor, initialsFor } from '@/dashboard/seedDashboard';

export default async function ProfilePage() {
  const user = await requireUser();
  const data = dashboardDataFor(user);

  return (
    <ProfileScreen
      name={user.name}
      email={user.email}
      initials={initialsFor(user.name)}
      role={data.candidate.role}
      memberSinceLabel={user.createdAt.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
      enrollments={data.enrollments}
      challenge={data.challenge}
    />
  );
}
