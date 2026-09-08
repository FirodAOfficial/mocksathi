/** Shared between the signup route and its client form. */

export const MIN_PASSWORD_LENGTH = 8;

// Deliberately permissive — this rejects obviously-malformed input, not
// anything RFC 5322 would. The account is confirmed by being able to sign in
// with it, not by the shape of the string.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
