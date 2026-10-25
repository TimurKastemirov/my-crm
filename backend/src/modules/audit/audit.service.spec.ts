import { describe, expect, it } from 'vitest';
import { normalizeIp } from './audit.service.js';

describe('normalizeIp', () => {
  it('unwraps IPv4 addresses mapped into IPv6', () => {
    expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeIp('::ffff:203.0.113.5')).toBe('203.0.113.5');
  });

  it('keeps real IPv6 and plain IPv4 as they are', () => {
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8::1');
    expect(normalizeIp('10.0.0.1')).toBe('10.0.0.1');
    expect(normalizeIp('::ffff:abcd')).toBe('::ffff:abcd');
  });
});
