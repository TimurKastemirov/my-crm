import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { TokenStorage } from './token-storage';

/** Adds a Bearer access token to API requests. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const access = inject(TokenStorage).access;
  if (access && req.url.includes('/api/')) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${access}` } });
  }
  return next(req);
};

/** On 401 (except for the auth requests themselves), ends the session and redirects to /login. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Public auth calls answer 401 for bad credentials — that's a form error, not an expired session.
      const isAuthCall =
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/register') ||
        req.url.includes('/auth/refresh') ||
        req.url.includes('/auth/invitations/');
      if (error.status === 401 && !isAuthCall) {
        auth.handleUnauthorized();
      }
      return throwError(() => error);
    }),
  );
};
