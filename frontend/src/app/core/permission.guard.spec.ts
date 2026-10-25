import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { PERMISSIONS, type Permission } from '@crm/shared';
import { AuthService } from './auth.service';
import { permissionGuard } from './permission.guard';

describe('permissionGuard', () => {
  function run(session: boolean, permissions: Permission[]): Promise<unknown> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            ensureSession: async () => session,
            can: (p: Permission) => permissions.includes(p),
          },
        },
      ],
    });
    const guard = permissionGuard(PERMISSIONS.MEMBERS_MANAGE);
    return TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Promise<unknown>;
  }

  it('lets the route through when the user has the permission', async () => {
    expect(await run(true, [PERMISSIONS.MEMBERS_MANAGE])).toBe(true);
  });

  it('redirects to the dashboard without the permission', async () => {
    const result = await run(true, [PERMISSIONS.DEALS_READ]);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });

  it('redirects to the dashboard without a session', async () => {
    expect(await run(false, [PERMISSIONS.MEMBERS_MANAGE])).toBeInstanceOf(UrlTree);
  });
});
