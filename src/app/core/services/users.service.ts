import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  UserListItem, UserDetail, UpdateUserRequest, ChangeRoleRequest,
  ResetPasswordRequest, ChangePasswordRequest, RegisterUserRequest,
} from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly usersUrl = '/api/users';
  private readonly authUrl = '/api/auth';

  constructor(private readonly http: HttpClient) {}

  getUsers(filters?: { search?: string; role?: string; isActive?: boolean }): Observable<UserListItem[]> {
    let params = new HttpParams();
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.role) params = params.set('role', filters.role);
    if (filters?.isActive !== undefined) params = params.set('isActive', String(filters.isActive));
    return this.http.get<UserListItem[]>(this.usersUrl, { params });
  }

  getUser(id: string): Observable<UserDetail> {
    return this.http.get<UserDetail>(`${this.usersUrl}/${id}`);
  }

  updateUser(id: string, req: UpdateUserRequest): Observable<UserDetail> {
    return this.http.put<UserDetail>(`${this.usersUrl}/${id}`, req);
  }

  changeRole(id: string, req: ChangeRoleRequest): Observable<void> {
    return this.http.patch<void>(`${this.usersUrl}/${id}/role`, req);
  }

  deactivate(id: string): Observable<void> {
    return this.http.post<void>(`${this.usersUrl}/${id}/deactivate`, {});
  }

  activate(id: string): Observable<void> {
    return this.http.post<void>(`${this.usersUrl}/${id}/activate`, {});
  }

  resetPassword(id: string, req: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.usersUrl}/${id}/reset-password`, req);
  }

  register(req: RegisterUserRequest): Observable<void> {
    return this.http.post<void>(`${this.authUrl}/register`, req);
  }

  changeOwnPassword(req: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.authUrl}/change-password`, req);
  }
}
