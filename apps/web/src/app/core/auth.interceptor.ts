import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  return next(request).pipe(
    catchError((error: unknown) => {
      const isAuthRequest = request.url.includes('/auth/login') || request.url.includes('/auth/register') || request.url.includes('/auth/refresh');
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isAuthRequest) {
        return throwError(() => error);
      }
      return auth.refreshSession().pipe(switchMap(() => next(request)));
    }),
  );
};
