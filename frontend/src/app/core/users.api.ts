import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AuthTokens,
  ChangePasswordRequest,
  UpdateProfileRequest,
  UpdateSettingsRequest,
  UserDto,
} from '@crm/shared';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly api = inject(ApiClient);

  /** PATCH /users/me — first/last name. */
  updateProfile(body: UpdateProfileRequest): Promise<UserDto> {
    return firstValueFrom(this.api.patch<UserDto>('/users/me', body));
  }

  /** PATCH /users/me/settings — UI language and time zone. */
  updateSettings(body: UpdateSettingsRequest): Promise<UserDto> {
    return firstValueFrom(this.api.patch<UserDto>('/users/me/settings', body));
  }

  /** PATCH /users/me/password — ends all sessions; returns tokens for the current one. */
  changePassword(body: ChangePasswordRequest): Promise<AuthTokens> {
    return firstValueFrom(this.api.patch<AuthTokens>('/users/me/password', body));
  }
}
