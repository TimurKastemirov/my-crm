import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { TokenStorage } from './token-storage';

/** Добавляет Bearer access-token к запросам к API. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const access = inject(TokenStorage).access;
  if (access && req.url.includes('/api/')) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${access}` } });
  }
  return next(req);
};

/** На 401 (кроме самих auth-запросов) чистит сессию и уводит на /login. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStorage);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthCall =
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/register') ||
        req.url.includes('/auth/refresh');
      if (error.status === 401 && !isAuthCall) {
        tokens.clear();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
