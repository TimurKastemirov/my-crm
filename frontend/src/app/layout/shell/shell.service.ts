import { Injectable, inject } from '@angular/core';
import { PERMISSIONS, type Permission } from '@crm/shared';
import { AuthService } from '../../core/auth.service';

export interface NavItem {
  path: string;
  label: string;
}

const NAV: Array<NavItem & { permission?: Permission }> = [
  { path: '/', label: 'nav.dashboard' },
  { path: '/contacts', label: 'nav.contacts' },
  { path: '/companies', label: 'nav.companies' },
  { path: '/leads', label: 'nav.leads' },
  { path: '/deals', label: 'nav.deals' },
  { path: '/tasks', label: 'nav.tasks' },
  { path: '/team', label: 'nav.team', permission: PERMISSIONS.MEMBERS_MANAGE },
  { path: '/profile', label: 'nav.profile' },
];

/** Shell business logic. Provided at the ShellComponent level (not a singleton). */
@Injectable()
export class ShellComponentService {
  private readonly auth = inject(AuthService);

  /** The currently signed-in user. */
  readonly user = this.auth.user;

  /** Navigation items the current user may open (reads the permissions signal, so it is reactive). */
  visibleNav(): NavItem[] {
    return NAV.filter((item) => !item.permission || this.auth.can(item.permission)).map(
      ({ path, label }) => ({ path, label }),
    );
  }

  /** Ends the session and redirects to the login screen. */
  logout(): void {
    void this.auth.logout();
  }
}
