import { describe, expect, it } from 'vitest';
import { sslFor } from './client';

/**
 * Whether the app can reach production at all turns on this: Supabase refuses
 * an unencrypted connection, and the local Docker database has no certificate
 * to present, so getting it backwards breaks one environment or the other.
 */
describe('sslFor', () => {
  it('asks for TLS on a hosted database', () => {
    for (const url of [
      'postgres://postgres:pw@db.dfowxomzcmnqzhsrtsnu.supabase.co:5432/postgres',
      'postgres://postgres.ref:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
    ]) {
      expect(sslFor(url)).toEqual({ rejectUnauthorized: false });
    }
  });

  it('leaves TLS off for the local Docker database', () => {
    // `db` is the service name inside docker-compose's network.
    for (const host of ['localhost', '127.0.0.1', 'db']) {
      expect(sslFor(`postgres://mocksathi:mocksathi@${host}:5432/mocksathi`)).toBe(false);
    }
  });

  it('does not guess when the string is not a URL', () => {
    expect(sslFor('host=example.com dbname=postgres')).toBe(false);
  });
});
