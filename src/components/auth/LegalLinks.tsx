import { LegalDocumentLink } from '@/components/legal/LegalDocumentLink';
import styles from './AuthCard.module.css';

export interface LegalLinksProps {
  agreed: boolean;
  onAgreedChange: (agreed: boolean) => void;
}

/**
 * `SignupForm` only — consent is a one-time, account-creation thing, not
 * something a returning user re-ticks on every sign-in, so `LoginForm` shows
 * no legal links or checkbox at all. Terms and Privacy only, not the Refund
 * & Cancellation Policy — nothing has been purchased yet at signup; that one
 * shows instead on the subscription screen, where a purchase actually
 * happens.
 *
 * Controlled rather than owning its own state: the checkbox gates the form's
 * submit button, which lives in the parent, so `agreed` has to be visible up
 * there. Clicking "Accept" inside either document's modal checks the box for
 * the reader — same effect as ticking it directly, just via having actually
 * opened the document first.
 */
export function LegalLinks({ agreed, onAgreedChange }: LegalLinksProps) {
  return (
    <label className={styles.consentRow}>
      <input
        type="checkbox"
        className={styles.consentCheckbox}
        checked={agreed}
        onChange={(event) => onAgreedChange(event.target.checked)}
      />
      <span className={styles.consentText}>
        I agree to the <LegalDocumentLink doc="terms" label="Terms & Conditions" onAccept={() => onAgreedChange(true)} />{' '}
        and <LegalDocumentLink doc="privacy" label="Privacy Policy" onAccept={() => onAgreedChange(true)} />.
      </span>
    </label>
  );
}
