import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import {
  managerAccessGuard,
  gateAccessGuard,
  yardAccessGuard,
  orderAccessGuard,
  operationsAccessGuard,
} from './role.guard';
import { AuthService } from '../services/auth.service';

describe('role guards', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = {} as RouterStateSnapshot;

  function setup(overrides?: {
    canManageYard?: () => boolean;
    canGateInOut?: () => boolean;
    canManageOrders?: () => boolean;
    isManager?: () => boolean;
  }) {
    const authServiceStub = {
      canManageYard: () => false,
      canGateInOut: () => false,
      canManageOrders: () => false,
      isManager: () => false,
      ...overrides,
    };

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

  it('yardAccessGuard allows YardPlanner/Manager capability', () => {
    setup({ canManageYard: () => true });
    const result = TestBed.runInInjectionContext(() => yardAccessGuard(dummyRoute, dummyState));
    expect(result).toBeTrue();
  });

  it('yardAccessGuard redirects when capability missing', () => {
    setup({ canManageYard: () => false });
    TestBed.runInInjectionContext(() => yardAccessGuard(dummyRoute, dummyState));
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/']);
  });

  it('gateAccessGuard allows GateOperator/Manager capability', () => {
    setup({ canGateInOut: () => true });
    const result = TestBed.runInInjectionContext(() => gateAccessGuard(dummyRoute, dummyState));
    expect(result).toBeTrue();
  });

  it('orderAccessGuard allows OrderClerk/Manager capability', () => {
    setup({ canManageOrders: () => true });
    const result = TestBed.runInInjectionContext(() => orderAccessGuard(dummyRoute, dummyState));
    expect(result).toBeTrue();
  });

  it('managerAccessGuard allows Manager', () => {
    setup({ isManager: () => true });
    const result = TestBed.runInInjectionContext(() => managerAccessGuard(dummyRoute, dummyState));
    expect(result).toBeTrue();
  });

  it('operationsAccessGuard allows gate users', () => {
    setup({ canGateInOut: () => true, canManageYard: () => false });
    const result = TestBed.runInInjectionContext(() => operationsAccessGuard(dummyRoute, dummyState));
    expect(result).toBeTrue();
  });

  it('operationsAccessGuard allows yard users', () => {
    setup({ canGateInOut: () => false, canManageYard: () => true });
    const result = TestBed.runInInjectionContext(() => operationsAccessGuard(dummyRoute, dummyState));
    expect(result).toBeTrue();
  });

  it('operationsAccessGuard redirects when both capabilities missing', () => {
    setup({ canGateInOut: () => false, canManageYard: () => false });
    TestBed.runInInjectionContext(() => operationsAccessGuard(dummyRoute, dummyState));
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/']);
  });

  it('yardMapAccessGuard allows OrderClerk (canManageOrders)', async () => {
    const { yardMapAccessGuard } = await import('./role.guard');
    setup({ canGateInOut: () => false, canManageYard: () => false, canManageOrders: () => true });
    const result = TestBed.runInInjectionContext(() => yardMapAccessGuard(dummyRoute, dummyState));
    expect(result).toBeTrue();
  });

  it('yardMapAccessGuard allows GateOperator', async () => {
    const { yardMapAccessGuard } = await import('./role.guard');
    setup({ canGateInOut: () => true, canManageYard: () => false, canManageOrders: () => false });
    const result = TestBed.runInInjectionContext(() => yardMapAccessGuard(dummyRoute, dummyState));
    expect(result).toBeTrue();
  });

  it('yardMapAccessGuard allows YardPlanner', async () => {
    const { yardMapAccessGuard } = await import('./role.guard');
    setup({ canGateInOut: () => false, canManageYard: () => true, canManageOrders: () => false });
    const result = TestBed.runInInjectionContext(() => yardMapAccessGuard(dummyRoute, dummyState));
    expect(result).toBeTrue();
  });

  it('yardMapAccessGuard redirects when user has none of the 3 roles', async () => {
    const { yardMapAccessGuard } = await import('./role.guard');
    setup({ canGateInOut: () => false, canManageYard: () => false, canManageOrders: () => false });
    TestBed.runInInjectionContext(() => yardMapAccessGuard(dummyRoute, dummyState));
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/']);
  });
});
