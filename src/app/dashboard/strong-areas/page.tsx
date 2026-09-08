import { requireUser } from '@/auth/cookies';
import styles from '@/components/dashboard/AnalysisScreen.module.css';
import { StrongAreasList } from '@/components/dashboard/StrongAreasList';
import { dashboardDataFor } from '@/dashboard/seedDashboard';

export default async function StrongAreasPage() {
  const user = await requireUser();
  const data = dashboardDataFor(user);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Strong Areas</h1>
        <p className={styles.subtitle}>Topics you&apos;ve mastered — keep them warm, don&apos;t re-drill them.</p>
      </div>
      <StrongAreasList strongAreas={data.strongAreas} />
    </>
  );
}
