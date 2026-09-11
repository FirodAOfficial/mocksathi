'use client';

import { useState } from 'react';
import { LegalModal } from './LegalModal';
import styles from './LegalDocumentLink.module.css';
import { PrivacyContent } from './PrivacyContent';
import { RefundPolicyContent } from './RefundPolicyContent';
import { TermsContent } from './TermsContent';

export type LegalDoc = 'terms' | 'privacy' | 'refund';

const DOC_META: Record<LegalDoc, { title: string; lastUpdated: string; Content: () => React.JSX.Element }> = {
  terms: { title: 'Terms and Conditions', lastUpdated: '10-09-2026', Content: TermsContent },
  privacy: { title: 'Privacy Policy', lastUpdated: '10-09-2026', Content: PrivacyContent },
  refund: { title: 'Refund & Cancellation Policy', lastUpdated: '10-09-2026', Content: RefundPolicyContent },
};

export interface LegalDocumentLinkProps {
  doc: LegalDoc;
  label: string;
  /** Called when the reader clicks "Accept" inside the modal. */
  onAccept?: () => void;
}

/**
 * An inline text trigger that opens one legal document in a modal — no
 * standalone page for it. Self-contained for open/close state, so several of
 * these can sit next to each other in one sentence (see `LegalLinks`,
 * `SubscriptionScreen`) without a shared parent needing to track which one is
 * open — but acceptance itself bubbles up via `onAccept`, since that's what
 * gates the caller's submit button/checkbox.
 */
export function LegalDocumentLink({ doc, label, onAccept }: LegalDocumentLinkProps) {
  const [open, setOpen] = useState(false);
  const { title, lastUpdated, Content } = DOC_META[doc];

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <LegalModal
          title={title}
          lastUpdated={lastUpdated}
          onClose={() => setOpen(false)}
          onAccept={() => {
            onAccept?.();
            setOpen(false);
          }}
        >
          <Content />
        </LegalModal>
      )}
    </>
  );
}
