import { Component, effect, inject, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import type { AppLocale } from '@crm/shared';
import { AuthService } from './core/auth.service';
import { LocaleService } from './core/locale.service';
import { UsersApi } from './core/users.api';
import { browserTimeZone } from './shared/date/datetime-local';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly usersApi = inject(UsersApi);
  /** Zone already sent this page load — a rejected zone is not retried on every user change. */
  private attemptedZone: string | null = null;

  constructor() {
    // Apply the signed-in user's saved language whenever the session loads/changes.
    // Kept out of AuthService to avoid a DI cycle (AuthService is referenced by the
    // HTTP error interceptor, which the translate loader's HttpClient runs through).
    // `untracked` so this only reacts to the user changing — not to `apply()` reading
    // the current lang, which would otherwise re-fire and fight the language switcher.
    // A language picked before signing in was sent with the sign-in and saved to the profile,
    // so the user's locale already reflects it — the pick is consumed here.
    effect(() => {
      const user = this.auth.user();
      if (user) {
        untracked(() => {
          this.locale.apply(user.locale as AppLocale);
          this.locale.clearChosenBeforeSignIn();
          void this.syncTimeZone(user.timezone);
        });
      }
    });
  }

  /**
   * Dates are shown in the browser's time zone; the profile remembers that zone for server-side
   * features (e.g. reminders). Best-effort: tried once per page load.
   */
  private async syncTimeZone(saved: string): Promise<void> {
    const zone = browserTimeZone();
    if (!zone || zone === saved || zone === this.attemptedZone) return;
    this.attemptedZone = zone;
    try {
      const updated = await this.usersApi.updateSettings({ timezone: zone });
      this.auth.user.update((u) => u && { ...u, timezone: updated.timezone });
    } catch {
      /* ignore */
    }
  }
}
