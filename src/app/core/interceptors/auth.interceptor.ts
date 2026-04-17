import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const SKIP_AUTH_URLS = ['/api/auth/login', '/api/auth/refresh-token'];

let isRefreshing = false;
const refreshToken$ = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);

  if (SKIP_AUTH_URLS.some(url => req.url.includes(url))) {
    return next(req);
  }

  const token = authService.getToken();
  const authedReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !SKIP_AUTH_URLS.some(url => req.url.includes(url))) {
        return handle401(req, next, authService);
      }
      return throwError(() => error);
    }),
  );
};

function handle401(req: HttpRequest<unknown>, next: HttpHandlerFn, authService: AuthService) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshToken$.next(null);

    const rt = authService.getRefreshToken();
    if (!rt) {
      isRefreshing = false;
      authService.logout();
      return throwError(() => new HttpErrorResponse({ status: 401 }));
    }

    return authService.refreshAccessToken(rt).pipe(
      switchMap(res => {
        isRefreshing = false;
        refreshToken$.next(res.token);
        return next(req.clone({ setHeaders: { Authorization: `Bearer ${res.token}` } }));
      }),
      catchError(err => {
        isRefreshing = false;
        authService.logout();
        return throwError(() => err);
      }),
    );
  }

  // Another request is already refreshing — wait for it
  return refreshToken$.pipe(
    filter(token => token !== null),
    take(1),
    switchMap(token => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
  );
}
