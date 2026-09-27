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
    summary: 'Регистрация',
    description:
      'Создаёт пользователя, новую организацию и членство-владельца, возвращает пару токенов.',
  })
  @ApiCreatedResponse({ type: AuthResultDto, description: 'Пользователь и организация созданы' })
  @ApiConflictResponse({ description: 'Пользователь с таким email уже существует' })
  @ApiTooManyRequestsResponse({ description: 'Превышен лимит запросов' })
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<AuthResult> {
    return this.auth.register(dto, this.meta(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Вход', description: 'Аутентификация по email и паролю.' })
  @ApiOkResponse({ type: AuthResultDto, description: 'Успешный вход' })
  @ApiUnauthorizedResponse({ description: 'Неверный email или пароль' })
  @ApiTooManyRequestsResponse({ description: 'Превышен лимит запросов' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResult> {
    return this.auth.login(dto, this.meta(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Обновление токенов',
    description:
      'Ротация refresh-токена: выдаёт новую пару, старый refresh отзывается. При повторном использовании отозванного токена гасится вся сессия.',
  })
  @ApiOkResponse({ type: AuthTokensDto, description: 'Новая пара токенов' })
  @ApiUnauthorizedResponse({ description: 'Недействительный, отозванный или просроченный токен' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken, this.meta(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Выход', description: 'Отзывает переданный refresh-токен.' })
  @ApiNoContentResponse({ description: 'Токен отозван' })
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Выход со всех устройств',
    description: 'Отзывает все активные refresh-токены текущего пользователя.',
  })
  @ApiNoContentResponse({ description: 'Все токены отозваны' })
  @ApiUnauthorizedResponse({ description: 'Требуется валидный access-token' })
  async logoutAll(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.auth.logoutAll(user.sub);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Текущая сессия', description: 'Возвращает профиль и активную организацию.' })
  @ApiOkResponse({ type: SessionInfoDto, description: 'Данные текущей сессии' })
  @ApiUnauthorizedResponse({ description: 'Требуется валидный access-token' })
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
