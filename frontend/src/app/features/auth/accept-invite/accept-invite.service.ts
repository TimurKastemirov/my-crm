import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { AcceptInvitationRequest, InvitationPreview } from '@crm/shared';
import { AuthService } from '../../../core/auth.service';
import { extractErrorMessage } from '../../../core/http-error';
import { LocaleService } from '../../../core/locale.service';

/** Invitation acceptance business logic. Provided at the AcceptInviteComponent level (not a singleton). */
@Injectable()
export class AcceptInviteComponentService {
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LocaleService);

  preview(token: string): Promise<InvitationPreview> {
    return this.auth.previewInvitation(token);
  }

  /**
   * Existing accounts send the password (plus a language picked on this screen, which then wins);
   * new accounts also send their names and start in the language currently on screen.
   */
  accept(
    token: string,
    userExists: boolean,
    value: { firstName: string; lastName: string; password: string },
  ): Promise<void> {
    const payload: AcceptInvitationRequest = userExists
      ? { token, password: value.password, locale: this.locale.chosenBeforeSignIn() ?? undefined }
      : {
          token,
          password: value.password,
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          locale: this.locale.lang(),
        };
    return this.auth.acceptInvitation(payload);
  }

  /** Turns a failed request into a user-facing message using the given i18n key as fallback. */
  errorMessage(error: unknown, key: string): string {
    return extractErrorMessage(error, this.translate.instant(key));
  }
}
