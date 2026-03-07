import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getAccessToken();

  const requestToSend = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req;

  return next(requestToSend).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      const isPublicAuthEndpoint =
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/signup') ||
        req.url.includes('/auth/refresh') ||
        req.url.includes('/auth/logout') ||
        req.url.includes('/auth/forgot-password') ||
        req.url.includes('/auth/reset-password');

      if (isUnauthorized && !isPublicAuthEndpoint && authService.hasPersistentSession()) {
        return authService.refreshSession().pipe(
          switchMap((tokens) =>
            next(
              req.clone({
                setHeaders: {
                  Authorization: `Bearer ${tokens.access_token}`
                }
              })
            )
          ),
          catchError((refreshError: unknown) => {
            const shouldClearSession =
              !(refreshError instanceof HttpErrorResponse) || refreshError.status === 401;

            if (!shouldClearSession) {
              return throwError(() => refreshError);
            }

            authService.clearTokens();

            if (!router.url.startsWith('/login')) {
              const redirect = router.url || '/warehouses';
              void router.navigate(['/login'], {
                queryParams: { redirect }
              });
            }

            return throwError(() => refreshError);
          })
        );
      }

      if (token && isUnauthorized && !isPublicAuthEndpoint) {
        authService.clearTokens();

        if (!router.url.startsWith('/login')) {
          const redirect = router.url || '/warehouses';
          void router.navigate(['/login'], {
            queryParams: { redirect }
          });
        }
      }

      return throwError(() => error);
    })
  );
};
