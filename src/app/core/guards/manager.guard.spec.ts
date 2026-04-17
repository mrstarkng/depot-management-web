import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { managerGuard } from './manager.guard';
import { AuthService } from '../services/auth.service';

describe('managerGuard (legacy)', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = {} as RouterStateSnapshot;

  function setup(isManager: boolean) {
    const authServiceStub = { isManager: () => isManager };
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

  it('should return true when user is Manager', () => {
    setup(true);
    const result = TestBed.runInInjectionContext(() => managerGuard(dummyRoute, dummyState));
    expect(result).toBeTrue();
  });

  it('should redirect to / when user is not Manager', () => {
    setup(false);
    TestBed.runInInjectionContext(() => managerGuard(dummyRoute, dummyState));
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/']);
  });
});
