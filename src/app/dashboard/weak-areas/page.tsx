import { requireUser } from '@/auth/cookies';
import styles from '@/components/dashboard/AnalysisScreen.module.css';
import { WeakAreasCallout } from '@/components/dashboard/WeakAreasCallout';
import { dashboardDataFor } from '@/dashboard/seedDashboard';

export default async function WeakAreasPage() {
  const user = await requireUser();
  const data = dashboardDataFor(user);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Weak Areas</h1>
        <p className={styles.subtitle}>Topics costing you the most marks, ranked by priority.</p>
      </div>
      <WeakAreasCallout weakAreas={data.weakAreas} showFooterLink={false} />
    </>
  );
}
