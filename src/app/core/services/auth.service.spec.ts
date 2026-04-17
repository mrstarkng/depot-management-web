import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree']);
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // L-T01: AuthService.login() calls POST /api/auth/login
  it('should call POST /api/auth/login with correct body', () => {
    service.login('manager', 'P@ssw0rd').subscribe();

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userName: 'manager', password: 'P@ssw0rd' });

    req.flush({ userId: '1', token: 'jwt-token', expires: '2099-01-01T00:00:00Z' });
    // flush profile call triggered by login tap
    httpMock.expectOne('/api/auth/profile').flush({ id: '1', userName: 'manager', email: '', fullName: 'Manager', roles: ['Manager'] });
  });

  // L-T02: AuthService.login() stores token in localStorage
  it('should store token in localStorage after login', () => {
    service.login('manager', 'P@ssw0rd').subscribe();

    const loginReq = httpMock.expectOne('/api/auth/login');
    loginReq.flush({ userId: '1', token: 'jwt-test-token', expires: '2099-12-31T00:00:00Z', refreshToken: 'refresh-123' });

    expect(localStorage.getItem('depot_token')).toBe('jwt-test-token');
    expect(localStorage.getItem('depot_expires')).toBe('2099-12-31T00:00:00Z');
    expect(localStorage.getItem('depot_refresh_token')).toBe('refresh-123');

    httpMock.expectOne('/api/auth/profile').flush({ id: '1', userName: 'manager', email: '', fullName: 'Manager', roles: ['Manager'] });
  });

  // Token expiry check
  it('should report token as expired when expiry is in the past', () => {
    localStorage.setItem('depot_token', 'some-token');
    localStorage.setItem('depot_expires', '2020-01-01T00:00:00Z');
    expect(service.isTokenExpired()).toBeTrue();
  });

  it('should report token as not expired when expiry is in the future', () => {
    localStorage.setItem('depot_token', 'some-token');
    localStorage.setItem('depot_expires', '2099-01-01T00:00:00Z');
    expect(service.isTokenExpired()).toBeFalse();
  });

  // getToken
  it('should return token from localStorage', () => {
    localStorage.setItem('depot_token', 'my-jwt');
    expect(service.getToken()).toBe('my-jwt');
  });

  it('should return null when no token stored', () => {
    expect(service.getToken()).toBeNull();
  });

  // fetchProfile sets currentUser and status
  it('should set currentUser and status after fetchProfile', () => {
    service.fetchProfile().subscribe();

    const req = httpMock.expectOne('/api/auth/profile');
    req.flush({ id: '1', userName: 'manager', email: 'a@b.com', fullName: 'Admin', roles: ['Manager'] });

    expect(service.currentUser()?.userName).toBe('manager');
    expect(service.status()).toBe('authenticated');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.isManager()).toBeTrue();
  });

  // logout clears session
  it('should clear session and navigate to login on logout', () => {
    localStorage.setItem('depot_token', 'some-token');
    localStorage.setItem('depot_refresh_token', 'some-refresh');
    localStorage.setItem('depot_expires', '2099-01-01T00:00:00Z');

    service.logout();

    expect(localStorage.getItem('depot_token')).toBeNull();
    expect(localStorage.getItem('depot_refresh_token')).toBeNull();
    expect(service.status()).toBe('anonymous');
    expect(service.currentUser()).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);

    // logout fires DELETE but we don't care about response
    httpMock.match('/api/auth/logout');
  });

  // bootstrapSession with no token
  it('should set anonymous status when no token in storage', async () => {
    await service.bootstrapSession();
    expect(service.status()).toBe('anonymous');
  });

  // refreshAccessToken
  it('should call POST /api/auth/refresh-token', () => {
    service.refreshAccessToken('old-refresh').subscribe();

    const req = httpMock.expectOne('/api/auth/refresh-token');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'old-refresh' });
    req.flush({ userId: '1', token: 'new-jwt', expires: '2099-12-31T00:00:00Z' });

    expect(localStorage.getItem('depot_token')).toBe('new-jwt');
  });
});
