/**
 * The verification email's content.
 *
 * Pure: takes a code, returns the three parts Resend needs. No key, no network,
 * no `server-only` — which is what lets the rendering be tested, and lets the
 * template be looked at without a Resend account.
 *
 * Written for mail clients, not browsers. Tables for layout, every style
 * inline, a system font stack, no JavaScript, no web fonts, no external images.
 * Gmail strips `<style>` blocks in some views, Outlook renders through Word,
 * and a remote image is blocked by default in most clients — so anything that
 * depends on one of those is a design that silently degrades for a large share
 * of recipients.
 */

export type OtpPurpose = 'email-verification';

export interface OtpEmailContent {
  subject: string;
  html: string;
  text: string;
}

const BRAND = '#1c6ef2';
const INK = '#0b1638';
const MUTED = '#64748b';
const BORDER = '#e5e9f2';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Minutes, for the copy — kept in step with `OTP_TTL_MS` by its caller. */
export interface OtpEmailOptions {
  code: string;
  purpose: OtpPurpose;
  expiresInMinutes: number;
}

export function otpEmailContent({ code, expiresInMinutes }: OtpEmailOptions): OtpEmailContent {
  const subject = `${code} is your MockSathi verification code`;

  /*
   * The code is in the subject line as well as the body.
   *
   * On a phone, the notification preview is often all someone reads — putting
   * the digits there saves opening the mail at all, and it is what every client
   * that offers to autofill a one-time code reads.
   */

  const text = [
    'MockSathi',
    '',
    'Verify your email',
    '',
    'Your verification code is:',
    '',
    code,
    '',
    `This code expires in ${expiresInMinutes} minutes.`,
    '',
    "If you didn't request this code, you can safely ignore this email.",
    '',
    '© MockSathi',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f4f9;">
<!-- Preheader: what a client shows beside the subject in the inbox list. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your MockSathi verification code is ${code}. It expires in ${expiresInMinutes} minutes.</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f4f9;">
<tr>
<td align="center" style="padding:32px 16px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;">
<tr>
<td style="padding:28px 32px 0;font-family:${FONT};">
<div style="font-size:19px;font-weight:700;color:${INK};letter-spacing:-0.01em;">Mock<span style="color:${BRAND};">Sathi</span></div>
</td>
</tr>
<tr>
<td style="padding:22px 32px 0;font-family:${FONT};">
<h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:${INK};">Verify your email</h1>
<p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#334155;">Your verification code is:</p>
</td>
</tr>
<tr>
<td style="padding:18px 32px 0;">
<!-- The code in its own bordered block: the one thing the recipient came for,
     and selectable as text so it can be copied rather than retyped. -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="background:#f6f8fc;border:1px solid ${BORDER};border-radius:10px;padding:18px 12px;font-family:${FONT};font-size:34px;font-weight:700;letter-spacing:0.22em;color:${INK};">${code}</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:18px 32px 0;font-family:${FONT};">
<p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">This code expires in ${expiresInMinutes} minutes.</p>
<p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">If you didn&rsquo;t request this code, you can safely ignore this email.</p>
</td>
</tr>
<tr>
<td style="padding:22px 32px 26px;font-family:${FONT};">
<div style="border-top:1px solid ${BORDER};padding-top:16px;font-size:12px;color:#94a3b8;">&copy; MockSathi</div>
</td>
</tr>
</table>

</td>
</tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
