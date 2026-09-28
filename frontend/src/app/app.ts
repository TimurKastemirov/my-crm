import { Component, effect, inject, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import type { AppLocale } from '@crm/shared';
import { AuthService } from './core/auth.service';
import { LocaleService } from './core/locale.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);

  constructor() {
    // Apply the signed-in user's saved language whenever the session loads/changes.
    // Kept out of AuthService to avoid a DI cycle (AuthService is referenced by the
    // HTTP error interceptor, which the translate loader's HttpClient runs through).
    // `untracked` so this only reacts to the user changing — not to `apply()` reading
    // the current lang, which would otherwise re-fire and fight the language switcher.
    effect(() => {
      const user = this.auth.user();
      if (user) untracked(() => this.locale.apply(user.locale as AppLocale));
    });
  }
}
