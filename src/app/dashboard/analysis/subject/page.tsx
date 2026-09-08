import { requireUser } from '@/auth/cookies';
import styles from '@/components/dashboard/AnalysisScreen.module.css';
import { SubjectSnapshotList } from '@/components/dashboard/SubjectSnapshotList';
import { dashboardDataFor } from '@/dashboard/seedDashboard';

export default async function SubjectAnalysisPage() {
  const user = await requireUser();
  const data = dashboardDataFor(user);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Subject Analysis</h1>
        <p className={styles.subtitle}>Marks, accuracy and pace, broken down by subject.</p>
      </div>
      <SubjectSnapshotList subjects={data.subjects} />
    </>
  );
}
