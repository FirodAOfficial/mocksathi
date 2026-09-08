import type { ReactNode } from 'react';
import { inter } from './authFont';
import styles from './AuthCard.module.css';

export interface AuthCardProps {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}

/** The Mocksathi-branded card shared by `/login` and `/signup`. */
export function AuthCard({ title, subtitle, footer, children }: AuthCardProps) {
  return (
    <div className={`${styles.screen} ${inter.className}`}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <div className={styles.logoMark}>M</div>
          <div>
            <div className={styles.logoName}>Mocksathi</div>
            <div className={styles.logoBy}>by TypingSathi</div>
          </div>
        </div>

        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>

        {children}

        <p className={styles.footer}>{footer}</p>
      </div>
    </div>
  );
}
