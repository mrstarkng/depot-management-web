import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UsersService],
    });
    service = TestBed.inject(UsersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getUsers() should call GET /api/users', () => {
    service.getUsers().subscribe();
    const req = httpMock.expectOne('/api/users');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getUsers() should pass filters as query params', () => {
    service.getUsers({ search: 'alice', role: 'Manager', isActive: false }).subscribe();
    const req = httpMock.expectOne(r =>
      r.url === '/api/users'
      && r.params.get('search') === 'alice'
      && r.params.get('role') === 'Manager'
      && r.params.get('isActive') === 'false',
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getUser() should call GET /api/users/:id', () => {
    service.getUser('abc-123').subscribe();
    const req = httpMock.expectOne('/api/users/abc-123');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('updateUser() should call PUT /api/users/:id with body', () => {
    service.updateUser('abc-123', { fullName: 'Jane Doe', email: 'jane@example.com' }).subscribe();
    const req = httpMock.expectOne('/api/users/abc-123');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.fullName).toBe('Jane Doe');
    req.flush({});
  });

  it('changeRole() should call PATCH /api/users/:id/role', () => {
    service.changeRole('abc-123', { role: 'Manager' }).subscribe();
    const req = httpMock.expectOne('/api/users/abc-123/role');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.role).toBe('Manager');
    req.flush(null);
  });

  it('deactivate() should call POST /api/users/:id/deactivate', () => {
    service.deactivate('abc-123').subscribe();
    const req = httpMock.expectOne('/api/users/abc-123/deactivate');
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('activate() should call POST /api/users/:id/activate', () => {
    service.activate('abc-123').subscribe();
    const req = httpMock.expectOne('/api/users/abc-123/activate');
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('resetPassword() should call POST /api/users/:id/reset-password with body', () => {
    service.resetPassword('abc-123', { newPassword: 'NewP@ssw0rd' }).subscribe();
    const req = httpMock.expectOne('/api/users/abc-123/reset-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.newPassword).toBe('NewP@ssw0rd');
    req.flush(null);
  });

  it('register() should call POST /api/auth/register with body', () => {
    service.register({
      userName: 'alice', email: 'alice@x.com', fullName: 'Alice',
      password: 'Passw0rd!', role: 'GateOperator',
    }).subscribe();
    const req = httpMock.expectOne('/api/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.role).toBe('GateOperator');
    req.flush(null);
  });

  it('changeOwnPassword() should call POST /api/auth/change-password with body', () => {
    service.changeOwnPassword({ currentPassword: 'old', newPassword: 'newer' }).subscribe();
    const req = httpMock.expectOne('/api/auth/change-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.currentPassword).toBe('old');
    req.flush(null);
  });
});
