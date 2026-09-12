import { CONTACT } from '@/site/contact';
import styles from './LegalContent.module.css';

/**
 * Content mirrors `MockSathi_Refund_Cancellation_Policy.md` verbatim
 * (converted to JSX), including its closing note that this is a
 * general-purpose draft to be reviewed by a qualified legal professional
 * before publishing — that caveat is part of the source document, kept as-is
 * rather than dropped.
 */
export function RefundPolicyContent() {
  return (
    <div className={styles.content}>
      <p>
        This Refund &amp; Cancellation Policy (&quot;Policy&quot;) applies to all purchases made on{' '}
        <strong>MockSathi</strong> (&quot;MockSathi&quot;, &quot;we&quot;, &quot;us&quot;,
        &quot;our&quot;), including mock test series, typing test packs, and subscription plans. By
        making a purchase on the Platform, you agree to the terms of this Policy, read together with
        our Terms and Conditions and Privacy Policy.
      </p>
      <hr />

      <h2>1. General Policy</h2>
      <p>
        Given the digital and instantly-accessible nature of our Service,{' '}
        <strong>all purchases are generally final and non-refundable</strong> once access to the
        purchased test series, mock test, or subscription has been granted — regardless of whether
        the content has actually been attempted or viewed. This is because the value of the product
        (access to the test bank) is delivered in full at the moment of purchase.
      </p>
      <p>
        We understand this can feel strict, so the sections below spell out the specific situations
        where a refund <strong>is</strong> available.
      </p>

      <h2>2. When a Refund IS Available</h2>
      <p>You may be eligible for a refund in the following cases:</p>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Situation</th>
              <th>Eligibility</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Duplicate payment</strong> — you were charged more than once for the same order due to a technical error</td>
              <td>Full refund of the duplicate amount</td>
            </tr>
            <tr>
              <td><strong>Payment debited but access not granted</strong> — money was deducted but your test/plan was never activated</td>
              <td>Full refund, or activation of access, at our discretion</td>
            </tr>
            <tr>
              <td><strong>Technical error attributable to MockSathi</strong> — e.g., you purchased a test series that was not actually available/functional on the Platform</td>
              <td>Full or partial refund, evaluated case-by-case</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Refunds outside these categories (e.g., &quot;I changed my mind,&quot; &quot;I don&apos;t
        have time to prepare anymore,&quot; &quot;I found a cheaper option&quot;) are{' '}
        <strong>not</strong> eligible under this Policy.
      </p>

      <h2>3. When a Refund is NOT Available</h2>
      <ul>
        <li>Once you have started attempting a test/mock within a purchased series.</li>
        <li>Change of mind after purchase, lack of time, or personal circumstances unrelated to a fault on our part.</li>
        <li>Non-usage of a purchased plan before its validity period expires.</li>
        <li>Purchases made using a coupon/discount code, beyond the discounted amount actually paid.</li>
        <li>Any violation of our Terms and Conditions (e.g., account sharing, malpractice) that leads to suspension of access.</li>
      </ul>

      <h2>4. How to Request a Refund</h2>
      <ol>
        <li>
          Email us at <strong>{CONTACT.email}</strong> within <strong>7 Days</strong> of the
          transaction date, using the subject line &quot;Refund Request.&quot;
        </li>
        <li>
          Include your <strong>registered email/phone number</strong>,{' '}
          <strong>order/transaction ID</strong>, and a brief description of the issue.
        </li>
        <li>
          Our team will review your request and respond within{' '}
          <strong>2–3 business days</strong> confirming whether the request is approved, along with
          next steps.
        </li>
      </ol>

      <h2>5. Refund Timelines &amp; Mode</h2>
      <ul>
        <li>
          Approved refunds are processed to the <strong>original mode of payment</strong> (the same
          card, UPI ID, or bank account used for the purchase).
        </li>
        <li>
          Processing typically takes <strong>7–14 working days</strong> from the date of approval,
          though actual credit to your account may take a few additional days depending on your
          bank or payment provider&apos;s processing time.
        </li>
        <li>We are not responsible for delays caused by your bank, card network, or payment gateway once the refund has been initiated from our end.</li>
      </ul>

      <h2>6. Subscription Cancellation &amp; Auto-Renewal</h2>
      <ul>
        <li>If a subscription plan includes auto-renewal, you will be notified before the renewal date (where required by applicable regulations).</li>
        <li>
          You can cancel auto-renewal at any time from <strong>Profile → My Purchases → Manage
          Subscription</strong>, or by contacting support, before the next billing cycle to avoid
          being charged.
        </li>
        <li>Cancelling auto-renewal stops future charges but does <strong>not</strong> entitle you to a refund for the current active billing period already paid for.</li>
      </ul>

      <h2>7. Coupons, Offers &amp; Promotional Purchases</h2>
      <ul>
        <li>
          If a purchase was made using a coupon or promotional discount, any approved refund will be
          limited to the <strong>actual amount paid</strong> (i.e., after the discount), not the
          original listed price.
        </li>
        <li>If a coupon required a minimum order value and part of that order is refunded such that the remaining amount falls below the coupon&apos;s minimum threshold, we reserve the right to adjust the refund amount accordingly.</li>
      </ul>

      <h2>8. Failed / Pending Transactions</h2>
      <ul>
        <li>
          If an amount is debited from your account but the transaction shows as &quot;failed&quot;
          or &quot;pending&quot; on the Platform, please <strong>wait 24–48 hours</strong>, as many
          such transactions are auto-reversed by the bank/payment gateway.
        </li>
        <li>
          If the amount is not reversed within this window, contact us at{' '}
          <strong>{CONTACT.email}</strong> with your bank statement/transaction reference, and
          we will investigate with our payment gateway partner.
        </li>
      </ul>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this Policy from time to time to reflect changes in our offerings or
        applicable law. The version published on the Platform at the time of your purchase (or, for
        disputes, at the time of your refund request) will apply. We recommend reviewing this page
        periodically.
      </p>

      <h2>10. Contact Us</h2>
      <p>For any refund or cancellation-related queries, reach out to:</p>
      <ul>
        <li><strong>Email:</strong> {CONTACT.email}</li>
        <li><strong>Phone:</strong> {CONTACT.phone}</li>
      </ul>

      <hr />
      <p>
        <em>
          Note: This is a general-purpose draft based on common practices across Indian ed-tech/
          test-prep platforms. Please have it reviewed by a qualified legal professional before
          publishing, and ensure the specific timelines (refund window, processing days) match what
          you can operationally commit to — payment gateways like Razorpay typically check that this
          page&apos;s stated terms match what you actually practice.
        </em>
      </p>
    </div>
  );
}
