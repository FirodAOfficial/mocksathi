import type { Metadata } from 'next';
import Link from 'next/link';
import { Bullets, Section, SitePage } from '@/components/site/SitePage';
import { CONTACT, MAIL_URL, POLICIES_UPDATED } from '@/site/contact';
import { pageMetadata } from '@/site/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Terms & Conditions',
  description:
    'The terms governing your use of MockSathi — accounts, paid plans and subscriptions, payments, coupons, permitted use of test content, and the limits of our liability.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <SitePage
      title="Terms and Conditions"
      lastUpdated={POLICIES_UPDATED}
      intro={
        <p>
          These Terms and Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the
          website, mobile application, and related services (collectively, the
          &ldquo;Platform&rdquo; or &ldquo;Service&rdquo;) operated by <strong>MockSathi</strong>{' '}
          (&ldquo;MockSathi&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By
          registering on, accessing, or using the Platform in any way, you (&ldquo;User&rdquo;,
          &ldquo;you&rdquo;, or &ldquo;your&rdquo;) agree to be bound by these Terms. If you do not
          agree with any part of these Terms, please do not use the Platform.
        </p>
      }
    >
      <Section heading="1. Definitions">
        <Bullets>
          <li>
            <strong>&ldquo;Service&rdquo;</strong> means all mock tests, typing tests, test series,
            practice sets, solutions, performance analytics, and related educational content offered
            through the Platform.
          </li>
          <li>
            <strong>&ldquo;Content&rdquo;</strong> means questions, answers, explanations, passages,
            videos, images, and any other material made available on the Platform.
          </li>
          <li>
            <strong>&ldquo;Subscription&rdquo; / &ldquo;Plan&rdquo;</strong> means any paid access to
            test series or features on the Platform.
          </li>
          <li>
            <strong>&ldquo;User Account&rdquo;</strong> means the account created by a User to access
            the Service.
          </li>
        </Bullets>
      </Section>

      <Section heading="2. Eligibility">
        <Bullets>
          <li>
            The Platform is intended for individuals preparing for competitive examinations and skill
            assessments (including typing proficiency).
          </li>
          <li>
            By creating an account, you confirm that the information you provide is accurate and that
            you have the legal capacity to enter into a binding agreement.
          </li>
          <li>
            If you are using the Platform on behalf of a minor, you confirm that you are their parent
            or legal guardian and consent to their use of the Platform under your supervision.
          </li>
        </Bullets>
      </Section>

      <Section heading="3. Account Registration & Security">
        <Bullets>
          <li>
            You must register with a valid email address and/or phone number to access most features
            of the Platform.
          </li>
          <li>
            You are solely responsible for maintaining the confidentiality of your login credentials
            (password/OTP) and for all activity that occurs under your account.
          </li>
          <li>You agree to notify us immediately of any unauthorized use of your account.</li>
          <li>
            One account is intended for use by one individual only. Sharing of login credentials,
            simultaneous logins for the purpose of sharing paid content, or reselling access is a
            violation of these Terms and may result in suspension or termination of your account
            without refund.
          </li>
        </Bullets>
      </Section>

      <Section heading="4. Description of Service">
        <p>MockSathi provides:</p>
        <Bullets>
          <li>Online mock tests and test series across various examination categories.</li>
          <li>Typing evaluation tests with performance metrics (speed, accuracy, errors).</li>
          <li>
            Instant results, score reports, percentile/rank comparisons, and section-wise analysis.
          </li>
          <li>Detailed solutions and explanations for attempted questions.</li>
          <li>
            Free and paid (subscription-based) test content, as identified on the Platform.
          </li>
        </Bullets>
        <p>
          We do not guarantee that using the Platform will result in success in any actual
          examination. All content is provided for practice and preparation purposes only.
        </p>
      </Section>

      <Section heading="5. Free and Paid Content">
        <Bullets>
          <li>
            Certain tests, features, or content may be offered free of charge, while others require
            purchase of a paid plan, individual test, or subscription.
          </li>
          <li>
            Prices displayed on the Platform are in Indian Rupees (INR) unless stated otherwise and
            are inclusive/exclusive of applicable taxes as indicated at checkout.
          </li>
          <li>
            We reserve the right to change prices, introduce new plans, or discontinue existing plans
            at any time, without affecting active subscriptions already purchased.
          </li>
        </Bullets>
      </Section>

      <Section heading="6. Payments & Payment Gateway">
        <Bullets>
          <li>
            All payments made on the Platform are processed through third-party payment gateway
            providers (e.g., Razorpay, PayU, or similar RBI-authorized payment processors).
          </li>
          <li>
            MockSathi does not store your complete card, UPI, or net-banking credentials; these are
            handled directly and securely by our payment gateway partner in accordance with
            applicable data security standards (such as PCI-DSS).
          </li>
          <li>
            You agree to provide accurate billing information. MockSathi is not responsible for
            payment failures, delays, or losses caused by incorrect information provided by you,
            network issues, or the payment gateway&rsquo;s systems.
          </li>
          <li>
            Upon successful payment confirmation, access to the purchased test/plan will be activated
            on your account, generally within a few minutes. If access is not activated despite a
            successful debit, please contact support with your transaction reference.
          </li>
        </Bullets>
      </Section>

      <Section heading="7. Coupons, Discounts & Promotional Offers">
        <Bullets>
          <li>
            From time to time, MockSathi may offer coupon codes, referral discounts, or promotional
            offers.
          </li>
          <li>
            Coupons are subject to the specific terms displayed at the time of the offer, including
            validity period, minimum order value, applicability to specific plans, and maximum usage
            limits per user.
          </li>
          <li>
            Coupons cannot be combined with other offers unless explicitly stated, cannot be
            exchanged for cash, and may be withdrawn or modified by MockSathi at any time without
            prior notice.
          </li>
          <li>
            MockSathi reserves the right to cancel a transaction or reclaim a discount if a coupon is
            found to have been used fraudulently or in violation of its stated terms.
          </li>
        </Bullets>
      </Section>

      <Section heading="8. Refund & Cancellation Policy">
        <Bullets>
          <li>
            Given the digital nature of the Service, purchases (including test series, subscriptions,
            and individual mock tests) are <strong>generally non-refundable</strong> once access to
            the content has been granted or the content has been attempted/viewed.
          </li>
          <li>
            Refund requests, where applicable (e.g., duplicate payment, failed activation despite
            successful payment, or technical error attributable to MockSathi), will be reviewed on a
            case-by-case basis and, if approved, processed to the original mode of payment within{' '}
            <strong>7–14 working days</strong>.
          </li>
          <li>
            To request a refund, contact us at <a href={MAIL_URL}>{CONTACT.email}</a> within 7 days
            of the transaction, along with your order/transaction ID.
          </li>
          <li>
            Subscription renewals, if auto-enabled, can be cancelled at any time from your account
            settings before the next billing cycle to avoid future charges.
          </li>
        </Bullets>
        <p>
          The full terms are set out in our{' '}
          <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
        </p>
      </Section>

      <Section heading="9. Prohibited Conduct">
        <p>You agree that you will not:</p>
        <Bullets>
          <li>
            Use any automated means (bots, scrapers, scripts) to access the Platform or extract
            Content.
          </li>
          <li>
            Attempt to copy, reproduce, republish, download, or distribute Content for any commercial
            purpose without written permission.
          </li>
          <li>
            Engage in any form of malpractice, including but not limited to using unauthorized aids
            during a test, sharing your account, or attempting to manipulate test results or
            leaderboards.
          </li>
          <li>
            Reverse-engineer, decompile, or attempt to extract the source code of the Platform.
          </li>
          <li>
            Upload or transmit any content that is unlawful, defamatory, obscene, or infringes on the
            rights of any third party.
          </li>
          <li>
            Interfere with or disrupt the integrity or performance of the Platform, including
            introducing viruses or malicious code.
          </li>
        </Bullets>
        <p>
          Violation of this section may result in immediate suspension or termination of your account
          without refund, and we reserve the right to pursue legal remedies where applicable.
        </p>
      </Section>

      <Section heading="10. Intellectual Property Rights">
        <Bullets>
          <li>
            All Content on the Platform — including questions, solutions, typing passages, graphics,
            logos, and the overall design/layout — is the exclusive property of MockSathi or its
            licensors and is protected under applicable copyright, trademark, and intellectual
            property laws.
          </li>
          <li>
            You are granted a limited, non-exclusive, non-transferable license to access and use the
            Content solely for personal, non-commercial exam-preparation purposes.
          </li>
          <li>
            No part of the Content may be reproduced, distributed, publicly displayed, or used to
            create derivative works without MockSathi&rsquo;s prior written consent.
          </li>
        </Bullets>
      </Section>

      <Section heading="11. User Feedback & Error Reports">
        <p>
          If you submit feedback, ratings, or report an error in a question (via the &ldquo;Report
          Error&rdquo; feature or otherwise), you grant MockSathi a royalty-free, perpetual license to
          use, modify, and incorporate such feedback to improve the Service, without any obligation
          to compensate you.
        </p>
      </Section>

      <Section heading="12. Third-Party Links & Services">
        <p>
          The Platform may contain links to third-party websites or services (including payment
          gateways, social media, or video hosting for solutions). MockSathi is not responsible for
          the content, policies, or practices of any third-party sites, and your use of such services
          is at your own risk and subject to their respective terms.
        </p>
      </Section>

      <Section heading="13. Disclaimer of Warranties">
        <Bullets>
          <li>
            The Platform and Service are provided on an <strong>&ldquo;as is&rdquo; and &ldquo;as
            available&rdquo;</strong> basis, without warranties of any kind, whether express or
            implied.
          </li>
          <li>
            MockSathi does not warrant that the Service will be uninterrupted, error-free, or
            completely secure, or that results/scores generated will be free from occasional
            discrepancies.
          </li>
          <li>
            Any performance analytics, rank, or percentile shown is for practice/preparation guidance
            only and does not guarantee outcomes in any actual examination.
          </li>
        </Bullets>
      </Section>

      <Section heading="14. Limitation of Liability">
        <p>
          To the maximum extent permitted by applicable law, MockSathi, its directors, employees, and
          affiliates shall not be liable for any indirect, incidental, special, or consequential
          damages, including loss of data, loss of profits, or loss of opportunity, arising out of or
          in connection with your use of (or inability to use) the Platform, even if advised of the
          possibility of such damages. Our aggregate liability, if any, shall not exceed the amount
          actually paid by you for the specific Service giving rise to the claim.
        </p>
      </Section>

      <Section heading="15. Indemnification">
        <p>
          You agree to indemnify and hold harmless MockSathi and its officers, employees, and
          affiliates from any claims, losses, liabilities, and expenses (including legal fees) arising
          out of your breach of these Terms, misuse of the Service, or violation of any applicable law
          or third-party right.
        </p>
      </Section>

      <Section heading="16. Termination">
        <Bullets>
          <li>
            We reserve the right to suspend or terminate your account, with or without notice, if we
            reasonably believe you have violated these Terms, engaged in fraudulent activity, or
            misused the Service.
          </li>
          <li>
            You may deactivate/delete your account at any time through your profile settings or by
            contacting support. Termination does not entitle you to a refund of any amount already
            paid, except as provided under Section 8.
          </li>
        </Bullets>
      </Section>

      <Section heading="17. Privacy">
        <p>
          Your use of the Platform is also governed by our <Link href="/privacy">Privacy Policy</Link>,
          which explains how we collect, use, and protect your personal information. By using the
          Platform, you consent to the practices described therein.
        </p>
      </Section>

      <Section heading="18. Governing Law & Jurisdiction">
        <p>
          These Terms shall be governed by and construed in accordance with the laws of India. Any
          disputes arising out of or in connection with these Terms shall be subject to the exclusive
          jurisdiction of the competent courts in India.
        </p>
      </Section>

      <Section heading="19. Changes to These Terms">
        <p>
          MockSathi reserves the right to modify, amend, or update these Terms at any time. Material
          changes will be notified through the Platform or via email. Your continued use of the
          Service after such changes constitutes your acceptance of the revised Terms. We recommend
          reviewing this page periodically.
        </p>
      </Section>

      <Section heading="20. Contact Us">
        <p>If you have any questions about these Terms, please reach out to us at:</p>
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
