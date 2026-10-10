import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { RegisterRequest } from '@crm/shared';
import { AuthService } from '../../../core/auth.service';
import { extractErrorMessage } from '../../../core/http-error';

/** Registration business logic. Provided at the RegisterComponent level (not a singleton). */
@Injectable()
export class RegisterComponentService {
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  /** Registers a new account and, on success, bootstraps the session. */
  register(payload: RegisterRequest): Promise<void> {
    return this.auth.register(payload);
  }

  /** Turns a failed registration into a user-facing message. */
  toErrorMessage(error: unknown): string {
    return extractErrorMessage(error, this.translate.instant('auth.failedRegister'));
  }
}
