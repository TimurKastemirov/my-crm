import { createHash, randomBytes } from 'node:crypto';

/** How long an invitation link stays valid. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A new random invitation token (shown to the inviter once; only its hash is stored). */
export function newInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Pending = not accepted, not revoked and not expired at `now`. */
export function isInvitationPending(
  invitation: {
    acceptedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
  },
  now: Date,
): boolean {
  return (
    !invitation.acceptedAt &&
    !invitation.revokedAt &&
    invitation.expiresAt.getTime() > now.getTime()
  );
}
