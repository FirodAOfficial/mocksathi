import styles from './LegalContent.module.css';

/** Content mirrors `MockSathi_Privacy_Policy.md` verbatim (converted to JSX). */
export function PrivacyContent() {
  return (
    <div className={styles.content}>
      <p>
        This Privacy Policy explains how <strong>MockSathi</strong> (&quot;MockSathi&quot;,
        &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, stores, and protects your
        information when you access or use our website, mobile application, and related services
        (collectively, the &quot;Platform&quot;). By using the Platform, you consent to the
        practices described in this Policy. Capitalized terms not defined here have the meaning
        given to them in our Terms and Conditions.
      </p>
      <hr />

      <h2>1. Information We Collect</h2>

      <h3>1.1 Information You Provide to Us</h3>
      <ul>
        <li><strong>Account details:</strong> Name, email address, phone number, password (stored in encrypted/hashed form), and profile photo (if uploaded).</li>
        <li><strong>Exam preferences:</strong> Exam category, target exams, and preferred language selected during onboarding.</li>
        <li><strong>Communication:</strong> Messages you send us via the contact form, support chat, or feedback/error-report features.</li>
        <li>
          <strong>Payment-related details:</strong> Billing name and, where applicable, GST/invoice
          details. We do <strong>not</strong> collect or store your full card number, CVV, UPI PIN,
          or net-banking credentials — these are captured and processed directly by our payment
          gateway partner (see Section 4).
        </li>
      </ul>

      <h3>1.2 Information Collected Automatically</h3>
      <ul>
        <li><strong>Usage data:</strong> Tests attempted, questions answered, time spent per question/section, scores, accuracy, WPM (for typing tests), login timestamps, and pages/features visited.</li>
        <li><strong>Device &amp; technical data:</strong> IP address, browser type, operating system, device identifiers, and approximate location (derived from IP).</li>
        <li><strong>Cookies &amp; similar technologies:</strong> Used to keep you logged in, remember preferences, and understand how the Platform is used (see Section 6).</li>
      </ul>

      <h3>1.3 Information from Third Parties</h3>
      <ul>
        <li>If you sign up or log in using a third-party service (e.g., Google), we receive basic profile information (name, email) as permitted by that service and your privacy settings there.</li>
        <li>Payment confirmation status and transaction references from our payment gateway partner.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Create and manage your account, and authenticate your login.</li>
        <li>Provide the Service — deliver mock tests, typing tests, results, performance analytics, and solutions.</li>
        <li>Process payments, activate purchased plans, and apply coupons/discounts.</li>
        <li>Send transactional communications (OTPs, purchase confirmations, result notifications, renewal reminders).</li>
        <li>Send promotional communications about new tests, offers, or features (you may opt out at any time — see Section 8).</li>
        <li>Analyze usage patterns to improve test content, fix bugs, and personalize recommendations (e.g., suggested mock tests).</li>
        <li>Detect and prevent fraud, malpractice, account sharing, or misuse of the Platform.</li>
        <li>Comply with legal obligations and enforce our Terms and Conditions.</li>
      </ul>

      <h2>3. Legal Basis for Processing</h2>
      <p>
        We process your personal data on the basis of: (a) your consent (e.g., at signup or when
        opting into marketing communications), (b) performance of a contract (delivering the Service
        you&apos;ve paid for), (c) our legitimate interests (improving the Platform, preventing
        fraud), and (d) compliance with applicable legal obligations.
      </p>

      <h2>4. Sharing of Information</h2>
      <p>We do not sell your personal information. We may share your information with:</p>
      <ul>
        <li><strong>Payment gateway partners</strong> (e.g., Razorpay, PayU, or similar RBI-authorised providers) — solely to process your payment. These providers have their own privacy policies governing how they handle your payment data.</li>
        <li><strong>Service providers</strong> who support our operations — hosting, cloud storage, email/SMS/WhatsApp delivery, analytics, and customer support tools — under confidentiality obligations and only to the extent necessary to perform their services.</li>
        <li><strong>Legal and regulatory authorities</strong>, where required to comply with applicable law, court orders, or to protect our rights, users, or the public.</li>
        <li><strong>Business transfers</strong>, in the event of a merger, acquisition, or sale of assets, where user information may be transferred as part of that transaction, subject to equivalent privacy protections.</li>
      </ul>

      <h2>5. Data Storage &amp; Security</h2>
      <ul>
        <li>Your data is stored on secure servers, with access restricted to authorized personnel on a need-to-know basis.</li>
        <li>We use industry-standard measures such as encryption in transit (HTTPS/TLS), password hashing, and access controls to protect your information.</li>
        <li>While we take reasonable steps to secure your data, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</li>
        <li>We retain your personal data for as long as your account is active, or as needed to provide the Service, comply with legal obligations, resolve disputes, and enforce our agreements. You may request deletion of your account and associated data as described in Section 8.</li>
      </ul>

      <h2>6. Cookies &amp; Tracking Technologies</h2>
      <ul>
        <li>We use cookies and similar technologies (local storage, SDKs) to keep you logged in, remember your preferences (e.g., language, theme), and understand aggregate usage trends through analytics tools.</li>
        <li>You can control or disable cookies through your browser settings; however, some features of the Platform (such as staying logged in) may not function properly if cookies are disabled.</li>
      </ul>

      <h2>7. Children&apos;s Privacy</h2>
      <p>
        The Platform is intended for exam aspirants generally aged 13 and above. If you are under
        18, you should use the Platform under the supervision of a parent or legal guardian, who is
        responsible for reviewing and agreeing to this Policy on your behalf. We do not knowingly
        collect personal information from children without appropriate parental consent; if we
        become aware that we have done so, we will take steps to delete such information.
      </p>

      <h2>8. Your Rights &amp; Choices</h2>
      <p>Depending on applicable law, you may have the right to:</p>
      <ul>
        <li><strong>Access</strong> the personal data we hold about you.</li>
        <li><strong>Correct</strong> inaccurate or incomplete information (editable via your Profile page for most fields).</li>
        <li><strong>Delete</strong> your account and associated personal data, subject to any legal retention requirements.</li>
        <li><strong>Withdraw consent</strong> for marketing communications at any time via the unsubscribe link in emails, or by adjusting notification preferences in your account settings.</li>
        <li><strong>Object to or restrict</strong> certain processing activities, where applicable.</li>
      </ul>
      <p>
        To exercise any of these rights, contact us at <strong>help@typingsathi.com</strong>. We will
        respond within a reasonable timeframe as required by applicable law.
      </p>

      <h2>9. Third-Party Links</h2>
      <p>
        The Platform may contain links to third-party websites (e.g., payment gateway checkout
        pages, video solution hosts, social media). This Policy does not apply to those third-party
        sites, and we encourage you to review their respective privacy policies.
      </p>

      <h2>10. International Users</h2>
      <p>
        The Platform is primarily intended for users in India, and your data is generally stored and
        processed within India. If you access the Platform from outside India, you do so on your own
        initiative and are responsible for compliance with local laws.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time to reflect changes in our practices or
        applicable law. Material changes will be notified through the Platform or via email, along
        with an updated &quot;Last Updated&quot; date. Your continued use of the Platform after such
        changes constitutes acceptance of the revised Policy.
      </p>

      <h2>12. Contact Us</h2>
      <p>If you have questions about this Privacy Policy or how your data is handled, please reach out to:</p>
      <ul>
        <li><strong>Email:</strong> help@typingsathi.com</li>
        <li><strong>Phone:</strong> +91 7690990908</li>
      </ul>
    </div>
  );
}
