import { describe, expect, it } from 'vitest';
import {
  MAX_PICTURE_BYTES,
  checkPicture,
  normaliseLinkHref,
} from './insertActions';

/**
 * The two Insert rules that are worth testing without an editor: what a
 * picture may be, and what a typed address turns into.
 */

describe('checkPicture', () => {
  it('accepts a picture inside the limit', () => {
    expect(checkPicture({ size: 1024, type: 'image/png' })).toBeNull();
  });

  it('refuses a file that is not a picture', () => {
    expect(checkPicture({ size: 10, type: 'application/pdf' })).toBe('wrong-type');
  });

  /*
   * Checked on size before the file is read: the data URL is about a third
   * larger again, so a 50 MB picture refused here is 67 MB of base64 that the
   * browser never builds.
   */
  it('refuses a picture over the limit', () => {
    expect(checkPicture({ size: MAX_PICTURE_BYTES + 1, type: 'image/png' })).toBe('too-large');
  });

  it('checks the type before the size, so the message names the real problem', () => {
    expect(checkPicture({ size: MAX_PICTURE_BYTES + 1, type: 'text/plain' })).toBe('wrong-type');
  });
});

describe('normaliseLinkHref', () => {
  it('leaves an address that already has a scheme', () => {
    expect(normaliseLinkHref('https://example.com/a')).toBe('https://example.com/a');
  });

  it('assumes https for what people actually type', () => {
    expect(normaliseLinkHref('www.example.com')).toBe('https://www.example.com/');
  });

  it('reads a bare address with an @ as an email', () => {
    expect(normaliseLinkHref('someone@example.com')).toBe('mailto:someone@example.com');
  });

  it('does not mistake a path containing @ for an email', () => {
    expect(normaliseLinkHref('example.com/@someone')).toBe('https://example.com/@someone');
  });

  /*
   * The one that matters. A `javascript:` href in a document the candidate
   * writes and the marker later renders is a script injection, so the schema
   * allows three protocols and this refuses everything else before it is ever
   * written.
   */
  it('refuses a scheme that is not http, https or mailto', () => {
    expect(normaliseLinkHref('javascript:alert(1)')).toBeNull();
    expect(normaliseLinkHref('data:text/html,<script>')).toBeNull();
    expect(normaliseLinkHref('file:///etc/passwd')).toBeNull();
  });

  it('refuses empty input rather than writing a dead link', () => {
    expect(normaliseLinkHref('   ')).toBeNull();
  });
});
