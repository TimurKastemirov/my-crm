import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Injectable()
export class ShellComponentService {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  readonly menuOpen = signal(false);

  readonly nav = [
    { path: '/', label: 'Dashboard' },
    { path: '/contacts', label: 'Contacts' },
    { path: '/companies', label: 'Companies' },
    { path: '/leads', label: 'Leads' },
    { path: '/deals', label: 'Deals' },
    { path: '/tasks', label: 'Tasks' },
  ];

  logout(): void {
    void this.auth.logout();
  }
}
