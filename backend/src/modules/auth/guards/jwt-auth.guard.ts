import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtPayload } from '@crm/shared';
import { SessionVersionService } from '../../security/session-version.service.js';

/**
 * Validates the Bearer access token and puts the payload on request.user.
 * Custom guard (without passport) — as in the spec, §4.1.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: SessionVersionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = header.slice('Bearer '.length).trim();
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    // Revoked by a password change / sign out everywhere (or the account is gone).
    const current = await this.sessions.current(payload.sub);
    if (current === null || (payload.sv ?? 0) !== current) {
      throw new UnauthorizedException('The session has been revoked');
    }
    request.user = payload;
    return true;
  }
}
