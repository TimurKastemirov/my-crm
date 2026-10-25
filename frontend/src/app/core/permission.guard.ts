import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { Permission } from '@crm/shared';
import { AuthService } from './auth.service';

/**
 * Lets the route through only if the user has the permission in the active organization;
 * otherwise redirects to the dashboard. UX only — the API enforces permissions itself.
 */
export function permissionGuard(permission: Permission): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const ok = (await auth.ensureSession()) && auth.can(permission);
    return ok ? true : router.parseUrl('/');
  };
}
