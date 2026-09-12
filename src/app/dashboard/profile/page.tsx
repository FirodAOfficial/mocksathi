import { requireUser } from '@/auth/cookies';
import { ProfileScreen } from '@/components/dashboard/ProfileScreen';
import { dashboardDataFor, initialsFor } from '@/dashboard/seedDashboard';
import { availableExamsForUser, enrollmentsForUser } from '@/db/enrollments';

export default async function ProfilePage() {
  const user = await requireUser();
  const [data, myEnrollments, availableExams] = await Promise.all([
    dashboardDataFor(user),
    enrollmentsForUser(user.id),
    availableExamsForUser(user.id),
  ]);

  return (
    <ProfileScreen
      name={user.name}
      email={user.email}
      initials={initialsFor(user.name)}
      role={data.candidate.role}
      avatarUrl={user.avatarUrl}
      memberSinceLabel={user.createdAt.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
      enrollments={myEnrollments.map((enrollment) => ({
        examId: enrollment.exam.id,
        examName: enrollment.exam.name,
        category: enrollment.exam.category,
        isPrimary: enrollment.isPrimary,
      }))}
      availableExams={availableExams.map((exam) => ({ id: exam.id, name: exam.name, category: exam.category }))}
      challenge={data.challenge}
    />
  );
}
