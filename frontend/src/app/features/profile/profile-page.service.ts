import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { UserDto } from '@crm/shared';
import { AuthService } from '../../core/auth.service';
import { extractErrorMessage } from '../../core/http-error';
import { UsersApi } from '../../core/users.api';
import { browserTimeZone } from '../../shared/date/datetime-local';

/** Profile and account settings business logic. Provided at the ProfilePageComponent level (not a singleton). */
@Injectable()
export class ProfilePageComponentService {
  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  /** The signed-in user (kept in sync after saving). */
  readonly user = this.auth.user;

  /** The zone dates are shown in. */
  timeZone(): string {
    return browserTimeZone() ?? 'UTC';
  }

  async saveProfile(value: { firstName: string; lastName: string }): Promise<UserDto> {
    const updated = await this.api.updateProfile({
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
    });
    // Merge only the names: replacing the whole user could reapply a stale language mid-switch.
    this.auth.user.update(
      (u) => u && { ...u, firstName: updated.firstName, lastName: updated.lastName },
    );
    return updated;
  }

  /** Whether the new password and its confirmation match (checked before calling the API). */
  passwordsMatch(value: { newPassword: string; confirmPassword: string }): boolean {
    return value.newPassword === value.confirmPassword;
  }

  /** Changes the password; the server ends all sessions and returns tokens for this one. */
  async changePassword(value: { currentPassword: string; newPassword: string }): Promise<void> {
    const tokens = await this.api.changePassword({
      currentPassword: value.currentPassword,
      newPassword: value.newPassword,
    });
    this.auth.useTokens(tokens);
  }

  /** Ends every session of the user, including this one (redirects to sign-in). */
  logoutEverywhere(): Promise<void> {
    return this.auth.logoutEverywhere();
  }

  /** Turns a failed request into a user-facing message using the given i18n key as fallback. */
  errorMessage(error: unknown, key: string): string {
    return extractErrorMessage(error, this.translate.instant(key));
  }
}
