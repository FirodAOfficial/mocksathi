import { describe, expect, it } from 'vitest';
import { DocumentError } from './errors';
import { isValidDocumentUrl, validateDocumentUrl } from './validateUrl';

describe('validateDocumentUrl', () => {
  it('accepts http and https addresses', () => {
    expect(validateDocumentUrl('https://example.com/a.docx').href).toBe('https://example.com/a.docx');
    expect(validateDocumentUrl(' http://example.com/a.docx ').href).toBe('http://example.com/a.docx');
  });

  it.each([
    ['file:///etc/passwd', 'a local file'],
    ['ftp://example.com/a.docx', 'a non-web scheme'],
    ['javascript:alert(1)', 'a script URL'],
    ['data:text/html,<script>', 'an inline data URL'],
  ])('rejects %s (%s)', (input) => {
    expect(() => validateDocumentUrl(input)).toThrow(DocumentError);
  });

  it('rejects addresses carrying credentials, which would be sent onward', () => {
    expect(() => validateDocumentUrl('https://user:secret@example.com/a.docx')).toThrow(/credentials/i);
  });

  it('rejects empty and malformed input', () => {
    expect(() => validateDocumentUrl('')).toThrow(DocumentError);
    expect(() => validateDocumentUrl(null)).toThrow(DocumentError);
    expect(() => validateDocumentUrl('not a url')).toThrow(DocumentError);
  });

  it('reports the failure as an INVALID_URL code the UI can render', () => {
    try {
      validateDocumentUrl('gopher://example.com');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentError);
      expect((error as DocumentError).code).toBe('INVALID_URL');
    }
  });

  it('offers a non-throwing form for UI checks', () => {
    expect(isValidDocumentUrl('https://example.com')).toBe(true);
    expect(isValidDocumentUrl('file:///tmp/x')).toBe(false);
  });
});
