import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthTokens, JwtPayload } from '@crm/shared';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { UserThrottlerGuard } from './guards/user-throttler.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { AuthTokensDto } from './dto/auth-response.dto.js';

/**
 * Account security endpoints under /users/me that need the auth stack (password hashing,
 * token issuing) — kept in AuthModule to avoid a Users ↔ Auth module cycle.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, UserThrottlerGuard)
export class AccountController {
  constructor(private readonly auth: AuthService) {}

  @Patch('me/password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Change password',
    description:
      'Verifies the current password, sets the new one and ends all sessions; returns a new token pair for this one.',
  })
  @ApiOkResponse({
    type: AuthTokensDto,
    description: 'New token pair for the current session',
  })
  @ApiBadRequestResponse({
    description:
      'Wrong current password, or the new one is invalid / unchanged',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<AuthTokens> {
    return this.auth.changePassword(user, dto, {
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip ?? null,
    });
  }
}
