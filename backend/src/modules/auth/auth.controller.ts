import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthResult, AuthTokens, JwtPayload, SessionInfo } from '@crm/shared';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import {
  AuthResultDto,
  AuthTokensDto,
  SessionInfoDto,
} from './dto/auth-response.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Register',
    description:
      'Creates a user, a new organization and an owner membership, and returns a token pair.',
  })
  @ApiCreatedResponse({ type: AuthResultDto, description: 'User and organization created' })
  @ApiConflictResponse({ description: 'A user with this email already exists' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<AuthResult> {
    return this.auth.register(dto, this.meta(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in', description: 'Authentication by email and password.' })
  @ApiOkResponse({ type: AuthResultDto, description: 'Successful login' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResult> {
    return this.auth.login(dto, this.meta(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Refresh tokens',
    description:
      'Refresh token rotation: issues a new pair, the old refresh token is revoked. Reusing a revoked token terminates the entire session.',
  })
  @ApiOkResponse({ type: AuthTokensDto, description: 'New token pair' })
  @ApiUnauthorizedResponse({ description: 'Invalid, revoked, or expired token' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken, this.meta(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Log out', description: 'Revokes the given refresh token.' })
  @ApiNoContentResponse({ description: 'Token revoked' })
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Log out from all devices',
    description: "Revokes all of the current user's active refresh tokens.",
  })
  @ApiNoContentResponse({ description: 'All tokens revoked' })
  @ApiUnauthorizedResponse({ description: 'A valid access token is required' })
  async logoutAll(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.auth.logoutAll(user.sub);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Current session', description: 'Returns the profile and active organization.' })
  @ApiOkResponse({ type: SessionInfoDto, description: 'Current session data' })
  @ApiUnauthorizedResponse({ description: 'A valid access token is required' })
  me(@CurrentUser() user: JwtPayload): Promise<SessionInfo> {
    return this.auth.me(user);
  }

  private meta(req: Request): { userAgent: string | null; ip: string | null } {
    return {
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip ?? null,
    };
  }
}
