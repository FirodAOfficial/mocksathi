import type { DashboardIconName } from './icons/DashboardIcon';
import { DashboardIcon } from './icons/DashboardIcon';
import headerStyles from './AnalysisScreen.module.css';
import styles from './ComingSoonScreen.module.css';

export interface ComingSoonScreenProps {
  icon: DashboardIconName;
  title: string;
  subtitle: string;
  note: string;
}

/**
 * A real, on-brand placeholder for the sidebar links that don't have a
 * screen behind them yet — every nav item resolves to something rather than
 * a 404, but this is honest about not being built, not a fake feature. See
 * `sdd/dashboard.md` Phase 5 for what each of these is meant to become.
 */
export function ComingSoonScreen({ icon, title, subtitle, note }: ComingSoonScreenProps) {
  return (
    <>
      <div className={headerStyles.header}>
        <h1 className={headerStyles.title}>{title}</h1>
        <p className={headerStyles.subtitle}>{subtitle}</p>
      </div>

      <div className={styles.card}>
        <div className={styles.icon}>
          <DashboardIcon name={icon} size={20} />
        </div>
        <p className={styles.title}>Coming soon</p>
        <p className={styles.body}>{note}</p>
      </div>
    </>
  );
}
