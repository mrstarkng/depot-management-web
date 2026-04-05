import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Placeholder: add auth headers when authentication is implemented
  // const authReq = req.clone({ withCredentials: true });
  // return next(authReq);
  return next(req);
};
