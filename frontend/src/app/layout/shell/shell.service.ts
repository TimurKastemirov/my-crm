import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Injectable()
export class ShellComponentService {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  readonly menuOpen = signal(false);

  // `label` is an i18n key resolved with the translate pipe in the template.
  readonly nav = [
    { path: '/', label: 'nav.dashboard' },
    { path: '/contacts', label: 'nav.contacts' },
    { path: '/companies', label: 'nav.companies' },
    { path: '/leads', label: 'nav.leads' },
    { path: '/deals', label: 'nav.deals' },
    { path: '/tasks', label: 'nav.tasks' },
  ];

  logout(): void {
    void this.auth.logout();
  }
}
