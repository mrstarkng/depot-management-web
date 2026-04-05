import { CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  // Placeholder: implement auth check when authentication is added
  return true;
};

export const guestGuard: CanActivateFn = () => {
  // Placeholder: redirect to home if already authenticated
  return true;
};
