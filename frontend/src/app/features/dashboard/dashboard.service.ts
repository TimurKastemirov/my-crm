import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';

/** Dashboard business logic. Provided at the DashboardComponent level (not a singleton). */
@Injectable()
export class DashboardComponentService {
  private readonly auth = inject(AuthService);

  /** The currently signed-in user. */
  readonly user = this.auth.user;
}
