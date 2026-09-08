import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Password hashing, via Node's built-in `crypto.scrypt` — no dependency
 * (`bcrypt`/`argon2`) needed, and no native module to compile, which matters
 * on this Windows dev box where a native binding (Rollup's) has already
 * failed to install once.
 */

// `util.promisify(scrypt)` resolves to the callback-only overload and loses
// the `options` parameter, so this wraps it by hand instead.
function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
// scrypt cost parameters. N is the CPU/memory cost (must be a power of two);
// these are Node's own documented defaults for interactive logins.
const N = 16384;
const r = 8;
const p = 1;

/** `scrypt:16384:8:1:<salt-hex>:<hash-hex>` — self-describing, so the cost
 * parameters can be tuned later without breaking existing hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const costN = Number(nStr);
  const costR = Number(rStr);
  const costP = Number(pStr);
  if (!Number.isInteger(costN) || !Number.isInteger(costR) || !Number.isInteger(costP)) return false;

  const salt = Buffer.from(saltHex!, 'hex');
  const expected = Buffer.from(hashHex!, 'hex');
  const actual = await scrypt(password.normalize('NFKC'), salt, expected.length, {
    N: costN,
    r: costR,
    p: costP,
  });

  // Both sides are fixed-length outputs of the same scrypt call, so this is
  // safe from length-based timing leaks; a wrong password just fails compare.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
