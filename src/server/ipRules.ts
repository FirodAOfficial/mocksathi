/**
 * Address-range rules for outbound document fetches.
 *
 * The proxy will follow a user-supplied URL, which makes it a server-side
 * request forgery primitive unless the destination is restricted. Anything that
 * is not a routable public address is refused — cloud metadata endpoints
 * (169.254.169.254), loopback, private LANs, and link-local ranges included.
 */

interface Cidr {
  /** Network address as a 32-bit unsigned integer. */
  network: number;
  bits: number;
}

const BLOCKED_V4: Cidr[] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, incl. cloud instance metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, incl. broadcast
].map(([address, bits]) => ({ network: ipv4ToInt(address as string), bits: bits as number }));

function ipv4ToInt(address: string): number {
  const parts = address.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return Number.NaN;
  }
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function isBlockedV4(address: string): boolean {
  const value = ipv4ToInt(address);
  if (Number.isNaN(value)) return true; // unparseable: refuse
  return BLOCKED_V4.some(({ network, bits }) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === (network & mask) >>> 0;
  });
}

function isBlockedV6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0] ?? '';

  if (normalized === '::' || normalized === '::1') return true;

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible forms tunnel the v4 rules.
  const mapped = /^::(?:ffff:(?:0{1,4}:)?)?(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped?.[1]) return isBlockedV4(mapped[1]);

  const firstGroup = normalized.split(':')[0] ?? '';
  const leading = Number.parseInt(firstGroup.padStart(4, '0'), 16);
  if (Number.isNaN(leading)) return true;

  if ((leading & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((leading & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((leading & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (leading === 0x2001 && normalized.startsWith('2001:db8')) return true; // documentation

  return false;
}

export function isBlockedAddress(address: string, family: 4 | 6): boolean {
  return family === 4 ? isBlockedV4(address) : isBlockedV6(address);
}
