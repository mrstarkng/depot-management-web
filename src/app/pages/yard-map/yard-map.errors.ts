import { HttpErrorResponse } from '@angular/common/http';

export interface YardMapErrorDescriptor {
  summary: string;
  detail: string;
  severity: 'error' | 'warn' | 'info';
  /** Optional follow-up hint for the caller (e.g., refresh lock, reload data). */
  action?: 'refreshLock' | 'reload' | 'login' | 'fieldError';
}

export function describeYardMapError(err: unknown, action: string): YardMapErrorDescriptor {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.Message || err.error?.message || err.statusText || 'Request failed';
    switch (err.status) {
      case 401:
        return { summary: 'Sign in required', detail: 'Your session expired.', severity: 'warn', action: 'login' };
      case 403:
        return { summary: 'Not allowed', detail: message, severity: 'warn' };
      case 404:
        return { summary: 'Not found', detail: message, severity: 'warn', action: 'reload' };
      case 409:
        return {
          summary: 'Conflict',
          detail: message || 'Data changed since you loaded it. Please reload and retry.',
          severity: 'warn',
          action: 'reload',
        };
      case 422:
        return {
          summary: 'Invalid layout',
          detail: message || 'Layout values are invalid.',
          severity: 'error',
          action: 'fieldError',
        };
      case 423:
        return {
          summary: 'Layout is locked',
          detail: message || 'Another user is editing the layout.',
          severity: 'warn',
          action: 'refreshLock',
        };
      default:
        return { summary: `${action} failed`, detail: message, severity: 'error' };
    }
  }

  return {
    summary: `${action} failed`,
    detail: (err as Error)?.message || 'Unknown error',
    severity: 'error',
  };
}
