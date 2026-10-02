import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Field.module.css';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string;
  /** Shown under the control, before any error. */
  help?: ReactNode;
  /** Shown under the control and announced. Marks the control invalid. */
  error?: ReactNode;
  /** Adds "(optional)" beside the label rather than marking everything else. */
  optional?: boolean;
}

/**
 * A text input with its label, help and error wired together.
 *
 * Every form in the product wired this by hand, so the wiring differed: some
 * had `htmlFor`, some relied on nesting, none connected the error text to the
 * control. Here `aria-describedby` points at whichever of help and error
 * exists, and `aria-invalid` follows the error — so a screen reader reaches the
 * field, hears its name, hears what is wrong with it, and hears it announced
 * again if it changes.
 *
 * Marking the optional ones rather than the required ones is deliberate: on a
 * form where nearly everything is required, asterisks everywhere carry no
 * information.
 */
export function Field({ label, help, error, optional, required, ...input }: FieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;

  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional ? <span className={styles.optional}>(optional)</span> : null}
      </label>

      <input
        id={id}
        className={`${styles.control} ${error ? styles.invalid : ''}`}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />

      {help ? (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      ) : null}

      {/*
        `aria-live` on the element rather than on a wrapper that appears with
        it: a live region has to be in the document before the text arrives,
        or there is no change for the browser to announce.
      */}
      <p id={errorId} className={styles.error} role="alert" aria-live="polite" hidden={!error}>
        {error}
      </p>
    </div>
  );
}
