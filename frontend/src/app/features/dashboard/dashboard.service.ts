import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Injectable()
export class DashboardComponentService {
  private readonly auth = inject(AuthService);
  readonly user = this.auth.user;
}
