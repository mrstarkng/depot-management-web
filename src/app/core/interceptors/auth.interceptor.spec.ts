import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';
import { Router } from '@angular/router';

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getToken', 'getRefreshToken', 'logout', 'refreshAccessToken']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should attach Bearer token to API requests', () => {
    authServiceSpy.getToken.and.returnValue('test-jwt-token');

    httpClient.get('/api/dashboard').subscribe();

    const req = httpMock.expectOne('/api/dashboard');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt-token');
    req.flush({});
  });

  it('should NOT attach token to login requests', () => {
    authServiceSpy.getToken.and.returnValue('test-jwt-token');

    httpClient.post('/api/auth/login', {}).subscribe();

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should NOT attach token to refresh-token requests', () => {
    authServiceSpy.getToken.and.returnValue('test-jwt-token');

    httpClient.post('/api/auth/refresh-token', {}).subscribe();

    const req = httpMock.expectOne('/api/auth/refresh-token');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should pass through when no token exists', () => {
    authServiceSpy.getToken.and.returnValue(null);

    httpClient.get('/api/containers').subscribe();

    const req = httpMock.expectOne('/api/containers');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush([]);
  });
});
