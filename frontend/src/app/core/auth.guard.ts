import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Пускает только аутентифицированных; иначе — на /login (с попыткой восстановить сессию по токену). */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const ok = await auth.ensureSession();
  return ok ? true : router.parseUrl('/login');
};

/** Для /login и /register: если уже вошли — на дашборд. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const ok = await auth.ensureSession();
  return ok ? router.parseUrl('/') : true;
};
