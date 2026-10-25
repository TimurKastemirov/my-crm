import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { LoginRequest } from '@crm/shared';
import { AuthService } from '../../../core/auth.service';
import { extractErrorMessage } from '../../../core/http-error';
import { LocaleService } from '../../../core/locale.service';

/** Login business logic. Provided at the LoginComponent level (not a singleton). */
@Injectable()
export class LoginComponentService {
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LocaleService);

  /**
   * Authenticates the user and, on success, bootstraps their session. A language picked on this
   * screen goes along with the credentials so the server saves it and the session starts in it.
   */
  login(credentials: LoginRequest): Promise<void> {
    const locale = this.locale.chosenBeforeSignIn() ?? undefined;
    return this.auth.login({ ...credentials, locale });
  }

  /** Turns a failed sign-in into a user-facing message. */
  toErrorMessage(error: unknown): string {
    return extractErrorMessage(error, this.translate.instant('auth.failedSignIn'));
  }
}
