import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { LoginRequest } from '@crm/shared';
import { AuthService } from '../../../core/auth.service';
import { extractErrorMessage } from '../../../core/http-error';

/** Login business logic. Provided at the LoginComponent level (not a singleton). */
@Injectable()
export class LoginComponentService {
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  /** Authenticates the user and, on success, bootstraps their session. */
  login(credentials: LoginRequest): Promise<void> {
    return this.auth.login(credentials);
  }

  /** Turns a failed sign-in into a user-facing message. */
  toErrorMessage(error: unknown): string {
    return extractErrorMessage(error, this.translate.instant('auth.failedSignIn'));
  }
}
