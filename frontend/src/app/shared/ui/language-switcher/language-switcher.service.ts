import { Injectable, inject } from '@angular/core';
import type { AppLocale } from '@crm/shared';
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

  /** Only the latest save may update the session (quick successive switches can resolve out of order). */
  private saveSeq = 0;

  /**
   * Applies the chosen language. Signed in: persists it to the profile right away.
   * Signed out: remembers it as an explicit pick that the next sign-in saves to the profile.
   */
  change(value: string): void {
    if (!this.locale.isSupported(value)) return;
    if (this.auth.isAuthenticated()) {
      this.locale.apply(value);
      void this.save(value);
    } else {
      this.locale.choose(value);
    }
  }

  private async save(locale: AppLocale): Promise<void> {
    const seq = ++this.saveSeq;
    try {
      await this.usersApi.updateProfile({ locale });
      // Keep the session in sync with the saved profile.
      if (seq === this.saveSeq) this.auth.user.update((u) => u && { ...u, locale });
    } catch {
      // Not saved: go back to the profile language so the screen matches what the next session shows.
      const saved = this.auth.user()?.locale;
      if (seq === this.saveSeq && this.locale.isSupported(saved)) this.locale.apply(saved);
    }
  }
}
