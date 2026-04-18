import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

describe('Auth Guards', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = {} as RouterStateSnapshot;

  function setup(isAuthenticated: boolean) {
    const authServiceStub = { isAuthenticated: () => isAuthenticated };
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.callFake((commands: string[]) => commands as any);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceStub },
        { provide: Router, useValue: routerSpy },
      ],
    });
  }

  describe('authGuard', () => {
    // L-T03: AuthGuard redirects to /login if not authenticated
    it('should redirect to /login when not authenticated', () => {
      setup(false);
      TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState));
      const call = routerSpy.createUrlTree.calls.mostRecent();
      expect(call.args[0]).toEqual(['/login']);
    });

    // L-T04: AuthGuard allows access if authenticated
    it('should return true when authenticated', () => {
      setup(true);
      const result = TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState));
      expect(result).toBeTrue();
    });
  });

  describe('guestGuard', () => {
    it('should redirect to / when authenticated', () => {
      setup(true);
      const result = TestBed.runInInjectionContext(() => guestGuard(dummyRoute, dummyState));
      expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/']);
    });

    it('should return true when not authenticated', () => {
      setup(false);
      const result = TestBed.runInInjectionContext(() => guestGuard(dummyRoute, dummyState));
      expect(result).toBeTrue();
    });
  });
});
