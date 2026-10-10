import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { LocaleService } from '../../../core/locale.service';
import { UsersApi } from '../../../core/users.api';

/** Language switch business logic. Provided at the LanguageSwitcherComponent level (not a singleton). */
@Injectable()
export class LanguageSwitcherComponentService {
  private readonly locale = inject(LocaleService);
  private readonly usersApi = inject(UsersApi);
  private readonly auth = inject(AuthService);

  readonly current = this.locale.lang;
  readonly options = this.locale.available;

  /** Applies the chosen language and, for signed-in users, persists it to their profile. */
  change(value: string): void {
    if (!this.locale.isSupported(value)) return;
    this.locale.apply(value);
    // Persist to the user's settings when signed in; keep the local switch even if it fails.
    if (this.auth.isAuthenticated()) {
      void this.usersApi.updateProfile({ locale: value }).catch(() => undefined);
    }
  }
}
