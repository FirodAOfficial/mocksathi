import styles from './AuthCard.module.css';

/**
 * The interactive nudge for "why is this disabled?" — used by both
 * `GoogleButton` and `SignupForm`'s own submit button when clicked before the
 * Terms/Privacy checkbox is agreed to. Neither renders as a truly
 * HTML-`disabled` element for exactly this reason: a disabled element never
 * fires `click`/`submit` at all, so there'd be nothing to hook a response
 * into — a hover-only `title` tooltip was the only feedback that existed
 * before this, invisible on mobile and easy to miss even on desktop.
 *
 * Scrolls the checkbox into view, focuses it (helps keyboard/screen-reader
 * users find it, not just a visual nudge), and re-triggers a CSS shake
 * animation — removing the class before re-adding it, with a forced reflow
 * in between, so clicking twice in a row still restarts the animation
 * instead of it being a no-op the second time.
 */
export function highlightConsent(): void {
  const row = document.getElementById('legal-consent-row');
  const checkbox = document.getElementById('legal-consent-checkbox');
  if (!row) return;

  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  checkbox?.focus();

  const shakeClass = styles.consentShakeActive;
  if (!shakeClass) return;
  row.classList.remove(shakeClass);
  void row.getBoundingClientRect();
  row.classList.add(shakeClass);
}
