import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Allows only authenticated users through; otherwise redirects to /login (attempting to restore the session from the token). */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const ok = await auth.ensureSession();
  return ok ? true : router.parseUrl('/login');
};

/** For /login and /register: if already logged in, redirect to the dashboard. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const ok = await auth.ensureSession();
  return ok ? router.parseUrl('/') : true;
};
