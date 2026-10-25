import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { JwtPayload } from '@crm/shared';

/**
 * Rate limit keyed by the signed-in user (falls back to the IP): guessing a current password
 * with a stolen access token can't be spread over many IPs, and users behind one NAT
 * don't throttle each other. Must run after JwtAuthGuard.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    req: Record<string, unknown>,
  ): Promise<string> {
    const user = req.user as JwtPayload | undefined;
    return user?.sub ? `user:${user.sub}` : String(req.ip);
  }
}
