import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';

/** Shell business logic. Provided at the ShellComponent level (not a singleton). */
@Injectable()
export class ShellComponentService {
  private readonly auth = inject(AuthService);

  /** The currently signed-in user. */
  readonly user = this.auth.user;

  /** Ends the session and redirects to the login screen. */
  logout(): void {
    void this.auth.logout();
  }
}
