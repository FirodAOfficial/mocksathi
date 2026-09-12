import type { Metadata } from 'next';
import Link from 'next/link';
import { Bullets, Section, SitePage, Steps, Table } from '@/components/site/SitePage';
import { CONTACT, MAIL_URL, POLICIES_UPDATED } from '@/site/contact';
import { pageMetadata } from '@/site/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Refund & Cancellation Policy',
  description:
    'When a MockSathi purchase can be refunded, when it cannot, how to request a refund within 7 days, refund timelines of 7–14 working days, and how to cancel subscription auto-renewal.',
  path: '/refund-policy',
});

export default function RefundPolicyPage() {
  return (
    <SitePage
      title="Refund & Cancellation Policy"
      lastUpdated={POLICIES_UPDATED}
      intro={
        <p>
          This Refund &amp; Cancellation Policy (&ldquo;Policy&rdquo;) applies to all purchases made
          on <strong>MockSathi</strong> (&ldquo;MockSathi&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;, &ldquo;our&rdquo;), including mock test series, typing test packs, and
          subscription plans. By making a purchase on the Platform, you agree to the terms of this
          Policy, read together with our <Link href="/terms">Terms and Conditions</Link> and{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      }
    >
      <Section heading="1. General Policy">
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
      </Section>

      <Section heading="2. When a Refund IS Available">
        <p>You may be eligible for a refund in the following cases:</p>
        <Table
          columns={['Situation', 'Eligibility']}
          rows={[
            [
              <>
                <strong>Duplicate payment</strong> — you were charged more than once for the same
                order due to a technical error
              </>,
              'Full refund of the duplicate amount',
            ],
            [
              <>
                <strong>Payment debited but access not granted</strong> — money was deducted but your
                test/plan was never activated
              </>,
              'Full refund, or activation of access, at our discretion',
            ],
            [
              <>
                <strong>Technical error attributable to MockSathi</strong> — e.g., you purchased a
                test series that was not actually available/functional on the Platform
              </>,
              'Full or partial refund, evaluated case-by-case',
            ],
          ]}
        />
        <p>
          Refunds outside these categories (e.g., &ldquo;I changed my mind,&rdquo; &ldquo;I
          don&rsquo;t have time to prepare anymore,&rdquo; &ldquo;I found a cheaper option&rdquo;) are{' '}
          <strong>not</strong> eligible under this Policy.
        </p>
      </Section>

      <Section heading="3. When a Refund is NOT Available">
        <Bullets>
          <li>Once you have started attempting a test/mock within a purchased series.</li>
          <li>
            Change of mind after purchase, lack of time, or personal circumstances unrelated to a
            fault on our part.
          </li>
          <li>Non-usage of a purchased plan before its validity period expires.</li>
          <li>
            Purchases made using a coupon/discount code, beyond the discounted amount actually paid.
          </li>
          <li>
            Any violation of our <Link href="/terms">Terms and Conditions</Link> (e.g., account
            sharing, malpractice) that leads to suspension of access.
          </li>
        </Bullets>
      </Section>

      <Section heading="4. How to Request a Refund">
        <Steps>
          <li>
            Email us at <a href={MAIL_URL}>{CONTACT.email}</a> within <strong>7 days</strong> of the
            transaction date, using the subject line &ldquo;Refund Request.&rdquo;
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
        </Steps>
      </Section>

      <Section heading="5. Refund Timelines & Mode">
        <Bullets>
          <li>
            Approved refunds are processed to the <strong>original mode of payment</strong> (the same
            card, UPI ID, or bank account used for the purchase).
          </li>
          <li>
            Processing typically takes <strong>7–14 working days</strong> from the date of approval,
            though actual credit to your account may take a few additional days depending on your bank
            or payment provider&rsquo;s processing time.
          </li>
          <li>
            We are not responsible for delays caused by your bank, card network, or payment gateway
            once the refund has been initiated from our end.
          </li>
        </Bullets>
      </Section>

      <Section heading="6. Subscription Cancellation & Auto-Renewal">
        <Bullets>
          <li>
            If a subscription plan includes auto-renewal, you will be notified before the renewal date
            (where required by applicable regulations).
          </li>
          <li>
            You can cancel auto-renewal at any time from{' '}
            <strong>Profile → My Purchases → Manage Subscription</strong>, or by contacting support,
            before the next billing cycle to avoid being charged.
          </li>
          <li>
            Cancelling auto-renewal stops future charges but does <strong>not</strong> entitle you to
            a refund for the current active billing period already paid for.
          </li>
        </Bullets>
      </Section>

      <Section heading="7. Coupons, Offers & Promotional Purchases">
        <Bullets>
          <li>
            If a purchase was made using a coupon or promotional discount, any approved refund will be
            limited to the <strong>actual amount paid</strong> (i.e., after the discount), not the
            original listed price.
          </li>
          <li>
            If a coupon required a minimum order value and part of that order is refunded such that
            the remaining amount falls below the coupon&rsquo;s minimum threshold, we reserve the
            right to adjust the refund amount accordingly.
          </li>
        </Bullets>
      </Section>

      <Section heading="8. Failed / Pending Transactions">
        <Bullets>
          <li>
            If an amount is debited from your account but the transaction shows as &ldquo;failed&rdquo;
            or &ldquo;pending&rdquo; on the Platform, please <strong>wait 24–48 hours</strong>, as many
            such transactions are auto-reversed by the bank/payment gateway.
          </li>
          <li>
            If the amount is not reversed within this window, contact us at{' '}
            <a href={MAIL_URL}>{CONTACT.email}</a> with your bank statement/transaction reference, and
            we will investigate with our payment gateway partner.
          </li>
        </Bullets>
      </Section>

      <Section heading="9. Changes to This Policy">
        <p>
          We may update this Policy from time to time to reflect changes in our offerings or applicable
          law. The version published on the Platform at the time of your purchase (or, for disputes, at
          the time of your refund request) will apply. We recommend reviewing this page periodically.
        </p>
      </Section>

      <Section heading="10. Contact Us">
        <p>For any refund or cancellation-related queries, reach out to:</p>
        <Bullets>
          <li>
            <strong>Email:</strong> <a href={MAIL_URL}>{CONTACT.email}</a>
          </li>
          <li>
            <strong>Phone:</strong> {CONTACT.phone}
          </li>
        </Bullets>
      </Section>
    </SitePage>
  );
}
