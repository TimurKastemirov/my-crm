import { describe, expect, it } from 'vitest';
import {
  hashInvitationToken,
  isInvitationPending,
  newInvitationToken,
} from './invitation-token.js';

describe('invitation token', () => {
  it('generates unique url-safe tokens', () => {
    const a = newInvitationToken();
    const b = newInvitationToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hashes deterministically to sha256 hex (the raw token is never stored)', () => {
    const token = newInvitationToken();
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token));
    expect(hashInvitationToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('isInvitationPending', () => {
  const now = new Date('2026-10-25T12:00:00Z');
  const future = new Date('2026-10-26T12:00:00Z');
  const past = new Date('2026-10-24T12:00:00Z');

  it('pending when not accepted, not revoked and not expired', () => {
    expect(
      isInvitationPending(
        { acceptedAt: null, revokedAt: null, expiresAt: future },
        now,
      ),
    ).toBe(true);
  });

  it('not pending once accepted, revoked or expired', () => {
    expect(
      isInvitationPending(
        { acceptedAt: past, revokedAt: null, expiresAt: future },
        now,
      ),
    ).toBe(false);
    expect(
      isInvitationPending(
        { acceptedAt: null, revokedAt: past, expiresAt: future },
        now,
      ),
    ).toBe(false);
    expect(
      isInvitationPending(
        { acceptedAt: null, revokedAt: null, expiresAt: past },
        now,
      ),
    ).toBe(false);
    expect(
      isInvitationPending(
        { acceptedAt: null, revokedAt: null, expiresAt: now },
        now,
      ),
    ).toBe(false);
  });
});
