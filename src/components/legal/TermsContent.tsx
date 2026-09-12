import { CONTACT } from '@/site/contact';
import styles from './LegalContent.module.css';

/**
 * Content follows `MockSathi_Terms_and_Conditions.md`, with two departures the
 * source document left open:
 *
 * - The support address and phone come from `CONTACT` rather than the draft's
 *   `help@typingsathi.com`, so all three policies quote one mailbox.
 * - The draft named the seat of jurisdiction as `[City, State]`. A bracketed
 *   placeholder on a live page is worse than a general clause, and inventing a
 *   city is not this component's call, so it reads "the competent courts in
 *   India" until a seat is chosen.
 */
export function TermsContent() {
  return (
    <div className={styles.content}>
      <p>
        These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of the website,
        mobile application, and related services (collectively, the &quot;Platform&quot; or
        &quot;Service&quot;) operated by <strong>MockSathi</strong> (&quot;MockSathi&quot;,
        &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By registering on, accessing, or using
        the Platform in any way, you (&quot;User&quot;, &quot;you&quot;, or &quot;your&quot;) agree
        to be bound by these Terms. If you do not agree with any part of these Terms, please do not
        use the Platform.
      </p>
      <hr />

      <h2>1. Definitions</h2>
      <ul>
        <li>
          <strong>&quot;Service&quot;</strong> means all mock tests, typing tests, test series,
          practice sets, solutions, performance analytics, and related educational content offered
          through the Platform.
        </li>
        <li>
          <strong>&quot;Content&quot;</strong> means questions, answers, explanations, passages,
          videos, images, and any other material made available on the Platform.
        </li>
        <li>
          <strong>&quot;Subscription&quot; / &quot;Plan&quot;</strong> means any paid access to test
          series or features on the Platform.
        </li>
        <li>
          <strong>&quot;User Account&quot;</strong> means the account created by a User to access the
          Service.
        </li>
      </ul>

      <h2>2. Eligibility</h2>
      <ul>
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
      </ul>

      <h2>3. Account Registration &amp; Security</h2>
      <ul>
        <li>You must register with a valid email address and/or phone number to access most features of the Platform.</li>
        <li>You are solely responsible for maintaining the confidentiality of your login credentials (password/OTP) and for all activity that occurs under your account.</li>
        <li>You agree to notify us immediately of any unauthorized use of your account.</li>
        <li>
          One account is intended for use by one individual only. Sharing of login credentials,
          simultaneous logins for the purpose of sharing paid content, or reselling access is a
          violation of these Terms and may result in suspension or termination of your account
          without refund.
        </li>
      </ul>

      <h2>4. Description of Service</h2>
      <p>MockSathi provides:</p>
      <ul>
        <li>Online mock tests and test series across various examination categories.</li>
        <li>Typing evaluation tests with performance metrics (speed, accuracy, errors).</li>
        <li>Instant results, score reports, percentile/rank comparisons, and section-wise analysis.</li>
        <li>Detailed solutions and explanations for attempted questions.</li>
        <li>Free and paid (subscription-based) test content, as identified on the Platform.</li>
      </ul>
      <p>
        We do not guarantee that using the Platform will result in success in any actual examination.
        All content is provided for practice and preparation purposes only.
      </p>

      <h2>5. Free and Paid Content</h2>
      <ul>
        <li>Certain tests, features, or content may be offered free of charge, while others require purchase of a paid plan, individual test, or subscription.</li>
        <li>Prices displayed on the Platform are in Indian Rupees (INR) unless stated otherwise and are inclusive/exclusive of applicable taxes as indicated at checkout.</li>
        <li>We reserve the right to change prices, introduce new plans, or discontinue existing plans at any time, without affecting active subscriptions already purchased.</li>
      </ul>

      <h2>6. Payments &amp; Payment Gateway</h2>
      <ul>
        <li>All payments made on the Platform are processed through third-party payment gateway providers (e.g., Razorpay, PayU, or similar RBI-authorized payment processors).</li>
        <li>MockSathi does not store your complete card, UPI, or net-banking credentials; these are handled directly and securely by our payment gateway partner in accordance with applicable data security standards (such as PCI-DSS).</li>
        <li>You agree to provide accurate billing information. MockSathi is not responsible for payment failures, delays, or losses caused by incorrect information provided by you, network issues, or the payment gateway&apos;s systems.</li>
        <li>Upon successful payment confirmation, access to the purchased test/plan will be activated on your account, generally within a few minutes. If access is not activated despite a successful debit, please contact support with your transaction reference.</li>
      </ul>

      <h2>7. Coupons, Discounts &amp; Promotional Offers</h2>
      <ul>
        <li>From time to time, MockSathi may offer coupon codes, referral discounts, or promotional offers.</li>
        <li>Coupons are subject to the specific terms displayed at the time of the offer, including validity period, minimum order value, applicability to specific plans, and maximum usage limits per user.</li>
        <li>Coupons cannot be combined with other offers unless explicitly stated, cannot be exchanged for cash, and may be withdrawn or modified by MockSathi at any time without prior notice.</li>
        <li>MockSathi reserves the right to cancel a transaction or reclaim a discount if a coupon is found to have been used fraudulently or in violation of its stated terms.</li>
      </ul>

      <h2>8. Refund &amp; Cancellation Policy</h2>
      <ul>
        <li>
          Given the digital nature of the Service, purchases (including test series, subscriptions,
          and individual mock tests) are <strong>generally non-refundable</strong> once access to the
          content has been granted or the content has been attempted/viewed.
        </li>
        <li>
          Refund requests, where applicable (e.g., duplicate payment, failed activation despite
          successful payment, or technical error attributable to MockSathi), will be reviewed on a
          case-by-case basis and, if approved, processed to the original mode of payment within
          <strong>7–14 working days</strong>.
        </li>
        <li>
          To request a refund, contact us at <strong>{CONTACT.email}</strong> within 7 Days of
          the transaction, along with your order/transaction ID.
        </li>
        <li>Subscription renewals, if auto-enabled, can be cancelled at any time from your account settings before the next billing cycle to avoid future charges.</li>
      </ul>
      <p>See the full Refund &amp; Cancellation Policy (shown on the subscription page) for details.</p>

      <h2>9. Prohibited Conduct</h2>
      <p>You agree that you will not:</p>
      <ul>
        <li>Use any automated means (bots, scrapers, scripts) to access the Platform or extract Content.</li>
        <li>Attempt to copy, reproduce, republish, download, or distribute Content for any commercial purpose without written permission.</li>
        <li>Engage in any form of malpractice, including but not limited to using unauthorized aids during a test, sharing your account, or attempting to manipulate test results or leaderboards.</li>
        <li>Reverse-engineer, decompile, or attempt to extract the source code of the Platform.</li>
        <li>Upload or transmit any content that is unlawful, defamatory, obscene, or infringes on the rights of any third party.</li>
        <li>Interfere with or disrupt the integrity or performance of the Platform, including introducing viruses or malicious code.</li>
      </ul>
      <p>
        Violation of this section may result in immediate suspension or termination of your account
        without refund, and we reserve the right to pursue legal remedies where applicable.
      </p>

      <h2>10. Intellectual Property Rights</h2>
      <ul>
        <li>All Content on the Platform — including questions, solutions, typing passages, graphics, logos, and the overall design/layout — is the exclusive property of MockSathi or its licensors and is protected under applicable copyright, trademark, and intellectual property laws.</li>
        <li>You are granted a limited, non-exclusive, non-transferable license to access and use the Content solely for personal, non-commercial exam-preparation purposes.</li>
        <li>No part of the Content may be reproduced, distributed, publicly displayed, or used to create derivative works without MockSathi&apos;s prior written consent.</li>
      </ul>

      <h2>11. User Feedback &amp; Error Reports</h2>
      <p>
        If you submit feedback, ratings, or report an error in a question (via the &quot;Report
        Error&quot; feature or otherwise), you grant MockSathi a royalty-free, perpetual license to
        use, modify, and incorporate such feedback to improve the Service, without any obligation to
        compensate you.
      </p>

      <h2>12. Third-Party Links &amp; Services</h2>
      <p>
        The Platform may contain links to third-party websites or services (including payment
        gateways, social media, or video hosting for solutions). MockSathi is not responsible for the
        content, policies, or practices of any third-party sites, and your use of such services is at
        your own risk and subject to their respective terms.
      </p>

      <h2>13. Disclaimer of Warranties</h2>
      <ul>
        <li>
          The Platform and Service are provided on an <strong>&quot;as is&quot; and &quot;as
          available&quot;</strong> basis, without warranties of any kind, whether express or implied.
        </li>
        <li>MockSathi does not warrant that the Service will be uninterrupted, error-free, or completely secure, or that results/scores generated will be free from occasional discrepancies.</li>
        <li>Any performance analytics, rank, or percentile shown is for practice/preparation guidance only and does not guarantee outcomes in any actual examination.</li>
      </ul>

      <h2>14. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, MockSathi, its directors, employees, and
        affiliates shall not be liable for any indirect, incidental, special, or consequential
        damages, including loss of data, loss of profits, or loss of opportunity, arising out of or
        in connection with your use of (or inability to use) the Platform, even if advised of the
        possibility of such damages. Our aggregate liability, if any, shall not exceed the amount
        actually paid by you for the specific Service giving rise to the claim.
      </p>

      <h2>15. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless MockSathi and its officers, employees, and
        affiliates from any claims, losses, liabilities, and expenses (including legal fees) arising
        out of your breach of these Terms, misuse of the Service, or violation of any applicable law
        or third-party right.
      </p>

      <h2>16. Termination</h2>
      <ul>
        <li>We reserve the right to suspend or terminate your account, with or without notice, if we reasonably believe you have violated these Terms, engaged in fraudulent activity, or misused the Service.</li>
        <li>You may deactivate/delete your account at any time through your profile settings or by contacting support. Termination does not entitle you to a refund of any amount already paid, except as provided under Section 8.</li>
      </ul>

      <h2>17. Privacy</h2>
      <p>
        Your use of the Platform is also governed by our Privacy Policy, which explains how we
        collect, use, and protect your personal information. By using the Platform, you consent to
        the practices described therein.
      </p>

      <h2>18. Governing Law &amp; Jurisdiction</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of India. Any
        disputes arising out of or in connection with these Terms shall be subject to the exclusive
        jurisdiction of the competent courts in India.
      </p>

      <h2>19. Changes to These Terms</h2>
      <p>
        MockSathi reserves the right to modify, amend, or update these Terms at any time. Material
        changes will be notified through the Platform or via email. Your continued use of the
        Service after such changes constitutes your acceptance of the revised Terms. We recommend
        reviewing this page periodically.
      </p>

      <h2>20. Contact Us</h2>
      <p>If you have any questions about these Terms, please reach out to us at:</p>
      <ul>
        <li><strong>{CONTACT.email}</strong></li>
        <li><strong>{CONTACT.phone}</strong></li>
      </ul>
    </div>
  );
}
