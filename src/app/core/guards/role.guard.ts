import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

type PermissionCheck = (authService: AuthService) => boolean;

export function permissionGuard(check: PermissionCheck): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (check(authService)) {
      return true;
    }

    return router.createUrlTree(['/']);
  };
}

export const yardAccessGuard = permissionGuard(auth => auth.canManageYard());
export const gateAccessGuard = permissionGuard(auth => auth.canGateInOut());
export const orderAccessGuard = permissionGuard(auth => auth.canManageOrders());
export const managerAccessGuard = permissionGuard(auth => auth.isManager());
export const operationsAccessGuard = permissionGuard(auth => auth.canGateInOut() || auth.canManageYard());
export const yardMapAccessGuard = permissionGuard(
  auth => auth.canGateInOut() || auth.canManageYard() || auth.canManageOrders(),
);
