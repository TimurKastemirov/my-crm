import type { AuthResult, AuthTokens, SessionInfo, UserDto } from '@crm/shared';

/**
 * Response DTOs for Swagger documentation. Classes (not interfaces from @crm/shared)
 * so the @nestjs/swagger CLI plugin can generate response body schemas.
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
  /** JWT access token (short-lived, for the Authorization header). */
  accessToken: string;
  /** Opaque refresh token (pass it to POST /auth/refresh). */
  refreshToken: string;
}

export class AuthResultDto implements AuthResult {
  user: UserResponseDto;
  tokens: AuthTokensDto;
}

export class SessionInfoDto implements SessionInfo {
  user: UserResponseDto;
  /** Active organization of the current session. */
  organizationId: string;
}
