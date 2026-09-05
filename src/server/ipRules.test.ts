import { describe, expect, it } from 'vitest';
import { isBlockedAddress } from './ipRules';

/**
 * These ranges are the SSRF boundary, so each family of "looks public but is
 * not" address is pinned explicitly — a regression here would let the proxy be
 * pointed at internal infrastructure.
 */
describe('isBlockedAddress', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['10.1.2.3', 'private class A'],
    ['172.16.0.1', 'private class B, low edge'],
    ['172.31.255.254', 'private class B, high edge'],
    ['192.168.1.1', 'private class C'],
    ['169.254.169.254', 'cloud instance metadata'],
    ['100.64.0.1', 'carrier-grade NAT'],
    ['0.0.0.0', 'unspecified'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'broadcast'],
    ['198.18.0.1', 'benchmarking'],
  ])('blocks %s (%s)', (address) => {
    expect(isBlockedAddress(address, 4)).toBe(true);
  });

  it.each([
    ['8.8.8.8'],
    ['1.1.1.1'],
    ['172.32.0.1'], // just outside the private class B block
    ['172.15.255.255'], // just below it
    ['93.184.216.34'],
  ])('allows the public address %s', (address) => {
    expect(isBlockedAddress(address, 4)).toBe(false);
  });

  it.each([
    ['::1', 'loopback'],
    ['::', 'unspecified'],
    ['fc00::1', 'unique local'],
    ['fd12:3456::1', 'unique local'],
    ['fe80::1', 'link-local'],
    ['ff02::1', 'multicast'],
    ['2001:db8::1', 'documentation'],
  ])('blocks IPv6 %s (%s)', (address) => {
    expect(isBlockedAddress(address, 6)).toBe(true);
  });

  it('sees through IPv4-mapped IPv6 addresses', () => {
    // ::ffff:127.0.0.1 reaches loopback despite looking like an IPv6 address.
    expect(isBlockedAddress('::ffff:127.0.0.1', 6)).toBe(true);
    expect(isBlockedAddress('::ffff:169.254.169.254', 6)).toBe(true);
    expect(isBlockedAddress('::ffff:8.8.8.8', 6)).toBe(false);
  });

  it('allows ordinary public IPv6', () => {
    expect(isBlockedAddress('2606:4700:4700::1111', 6)).toBe(false);
  });

  it('refuses addresses it cannot parse rather than letting them through', () => {
    expect(isBlockedAddress('not-an-ip', 4)).toBe(true);
    expect(isBlockedAddress('999.1.1.1', 4)).toBe(true);
  });
});
