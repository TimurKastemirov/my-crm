import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AppLocale, UserDto } from '@crm/shared';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly api = inject(ApiClient);

  /** PATCH /users/me — persist the current user's settings (e.g. UI language). */
  updateProfile(body: { locale?: AppLocale }): Promise<UserDto> {
    return firstValueFrom(this.api.patch<UserDto>('/users/me', body));
  }
}
