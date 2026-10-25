import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
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

/**
 * On 401 (except for the auth requests themselves) renews the access token with the refresh token
 * and retries the request once; concurrent 401s share one refresh, and a request whose token was
 * already replaced just retries with the current one. If the session can't be renewed (refresh
 * token revoked/expired) or the retry is refused too, ends the session → /login.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isAuthCall(req.url)) {
        return throwError(() => error);
      }
      const sent = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? null;
      return from(auth.refreshAccessToken(sent)).pipe(
        // Transient refresh failure (network, 5xx, 429): fail this request, keep the session.
        catchError(() => throwError(() => error)),
        switchMap((accessToken) => {
          if (!accessToken) {
            auth.handleUnauthorized();
            return throwError(() => error);
          }
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })).pipe(
            catchError((retryError: HttpErrorResponse) => {
              if (retryError.status === 401) auth.handleUnauthorized();
              return throwError(() => retryError);
            }),
          );
        }),
      );
    }),
  );
};

/** Public auth calls answer 401 for bad credentials — a form error, not an expired session. */
function isAuthCall(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/invitations/')
  );
}
