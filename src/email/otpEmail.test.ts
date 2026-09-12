import { describe, expect, it } from 'vitest';
import { otpEmailContent } from './otpEmail';

/**
 * What the recipient actually gets.
 *
 * The template is pure, so this is checkable without a Resend key — and the
 * things worth checking are the ones that fail silently in a mail client: a
 * remote asset that is blocked, a `<style>` block that is stripped, a code that
 * only exists in the HTML half.
 */

const CONTENT = otpEmailContent({ code: '048261', purpose: 'email-verification', expiresInMinutes: 10 });

describe('otpEmailContent', () => {
  it('puts the code in the subject, the HTML and the plain text', () => {
    // Subject: on a phone the notification preview is often all that is read,
    // and it is what a client's one-time-code autofill reads.
    expect(CONTENT.subject).toContain('048261');
    expect(CONTENT.html).toContain('048261');
    expect(CONTENT.text).toContain('048261');
  });

  it('keeps a leading zero intact', () => {
    // A code is a string, not a number. Anything that round-trips it through
    // one would render 48261 and the recipient would type five digits.
    expect(CONTENT.subject.startsWith('048261')).toBe(true);
    // The code stands alone on its own line in the text part, so a six-digit
    // line is the assertion — a stripped zero would leave five.
    expect(CONTENT.text.split('\n')).toContain('048261');
  });

  it('states the expiry the policy actually uses', () => {
    expect(CONTENT.html).toContain('expires in 10 minutes');
    expect(CONTENT.text).toContain('expires in 10 minutes');
  });

  it('tells a recipient who did not ask what to do', () => {
    expect(CONTENT.text).toContain("If you didn't request this code");
  });

  it('carries no script', () => {
    expect(CONTENT.html).not.toMatch(/<script/i);
    expect(CONTENT.html).not.toMatch(/on(click|load|error)=/i);
  });

  it('loads nothing from the network', () => {
    // A remote image is blocked by default in most clients, and a web font
    // never arrives in Outlook — so a template that needs either degrades
    // silently for a large share of recipients.
    expect(CONTENT.html).not.toMatch(/<img/i);
    expect(CONTENT.html).not.toMatch(/https?:\/\//);
    expect(CONTENT.html).not.toMatch(/@import|fonts\.googleapis/i);
  });

  it('styles inline rather than in a stripped style block', () => {
    // Gmail removes `<style>` in some views; Outlook renders through Word.
    expect(CONTENT.html).not.toMatch(/<style/i);
    expect(CONTENT.html).toContain('style="');
  });

  it('lays out with tables, which is what Outlook understands', () => {
    expect(CONTENT.html).toContain('<table role="presentation"');
  });

  it('is a complete document with a charset', () => {
    expect(CONTENT.html.startsWith('<!doctype html>')).toBe(true);
    expect(CONTENT.html).toContain('<meta charset="utf-8">');
  });

  it('keeps the plain text readable on its own', () => {
    // The text part is not a fallback nobody sees: it is what a screen reader
    // in text mode, and a client set to plain text, actually render.
    expect(CONTENT.text).not.toMatch(/<[a-z]/i);
    expect(CONTENT.text).toContain('Verify your email');
    expect(CONTENT.text).toContain('MockSathi');
  });
});
