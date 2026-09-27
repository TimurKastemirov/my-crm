import type { AuthResult, AuthTokens, SessionInfo, UserDto } from '@crm/shared';

/**
 * Response-DTO для документации Swagger. Классы (а не interface из @crm/shared),
 * чтобы CLI-плагин @nestjs/swagger сгенерировал схемы тел ответов.
 */
export class UserResponseDto implements UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class AuthTokensDto implements AuthTokens {
  /** JWT access-токен (короткоживущий, для заголовка Authorization). */
  accessToken: string;
  /** Opaque refresh-токен (передавать в POST /auth/refresh). */
  refreshToken: string;
}

export class AuthResultDto implements AuthResult {
  user: UserResponseDto;
  tokens: AuthTokensDto;
}

export class SessionInfoDto implements SessionInfo {
  user: UserResponseDto;
  /** Активная организация текущей сессии. */
  organizationId: string;
}
