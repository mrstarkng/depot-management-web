import { Injectable, signal, computed } from '@angular/core';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { UserProfile, AuthResponse, RefreshTokenRequest } from '../models/auth.models';

const TOKEN_KEY = 'depot_token';
const REFRESH_TOKEN_KEY = 'depot_refresh_token';
const EXPIRES_KEY = 'depot_expires';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = '/api/auth';
  private readonly authHttp: HttpClient;

  readonly status = signal<'checking' | 'authenticated' | 'anonymous'>('checking');
  readonly currentUser = signal<UserProfile | null>(null);
  readonly isAuthenticated = computed(() => this.status() === 'authenticated' && this.currentUser() !== null);
  readonly isManager = computed(() => this.currentUser()?.roles.includes('Manager') ?? false);

  readonly canManageYard = computed(() => this.hasRole('YardPlanner') || this.hasRole('Manager'));
  readonly canGateInOut = computed(() => this.hasRole('GateOperator') || this.hasRole('Manager'));
  readonly canManageOrders = computed(() => this.hasRole('OrderClerk') || this.hasRole('Manager'));
  readonly roleName = computed(() => {
    const roles = this.currentUser()?.roles ?? [];
    if (roles.includes('Manager')) return 'Depot Manager';
    if (roles.includes('YardPlanner')) return 'Yard Planner';
    if (roles.includes('GateOperator')) return 'Gate Operator';
    if (roles.includes('OrderClerk')) return 'Order Clerk';
    return 'Depot Staff';
  });

  constructor(
    private readonly router: Router,
    httpBackend: HttpBackend,
  ) {
    this.authHttp = new HttpClient(httpBackend);
  }

  hasRole(role: string): boolean {
    return this.currentUser()?.roles.includes(role) ?? false;
  }

  bootstrapSession(): Promise<void> {
    const token = this.getToken();
    if (!token) {
      this.status.set('anonymous');
      return Promise.resolve();
    }

    if (this.isTokenExpired()) {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
        return new Promise<void>((resolve) => {
          this.refreshAccessToken(refreshToken).subscribe({
            next: () => {
              this.fetchProfile().subscribe({
                next: () => resolve(),
                error: () => { this.clearSession(); resolve(); },
              });
            },
            error: () => { this.clearSession(); resolve(); },
          });
        });
      }

      this.clearSession();
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.fetchProfile().subscribe({
        next: () => resolve(),
        error: () => { this.clearSession(); resolve(); },
      });
    });
  }

  login(userName: string, password: string, rememberMe = true): Observable<AuthResponse> {
    this.status.set('checking');

    return this.authHttp.post<AuthResponse>(`${this.baseUrl}/login`, { userName, password }).pipe(
      tap(res => this.storeTokens(res, rememberMe)),
      switchMap(res => this.fetchProfile().pipe(map(() => res))),
      catchError(error => {
        this.clearSession();
        return throwError(() => error);
      }),
    );
  }

  logout(): void {
    const token = this.getToken();
    if (token) {
      this.authHttp.delete(`${this.baseUrl}/logout`, {
        headers: this.buildAuthHeaders(token),
      }).pipe(catchError(() => of(null))).subscribe();
    }

    this.clearSession();
    this.router.navigate(['/login']);
  }

  fetchProfile(): Observable<UserProfile> {
    const token = this.getToken();

    return this.authHttp.get<UserProfile>(`${this.baseUrl}/profile`, {
      headers: token ? this.buildAuthHeaders(token) : undefined,
    }).pipe(
      tap(user => {
        this.currentUser.set(user);
        this.status.set('authenticated');
      }),
    );
  }

  refreshAccessToken(refreshToken: string): Observable<AuthResponse> {
    const req: RefreshTokenRequest = { token: refreshToken };
    return this.authHttp.post<AuthResponse>(`${this.baseUrl}/refresh-token`, req).pipe(
      tap(res => this.storeTokens(res)),
    );
  }

  getToken(): string | null {
    return this.readStoredValue(TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return this.readStoredValue(REFRESH_TOKEN_KEY);
  }

  isTokenExpired(): boolean {
    const expires = this.readStoredValue(EXPIRES_KEY);
    if (!expires) return true;
    return new Date(expires).getTime() <= Date.now();
  }

  private storeTokens(res: AuthResponse, persistTo?: boolean): void {
    const storage = typeof persistTo === 'boolean'
      ? (persistTo ? localStorage : sessionStorage)
      : (this.getActiveStorage() ?? localStorage);
    const otherStorage = storage === localStorage ? sessionStorage : localStorage;

    otherStorage.removeItem(TOKEN_KEY);
    otherStorage.removeItem(REFRESH_TOKEN_KEY);
    otherStorage.removeItem(EXPIRES_KEY);

    storage.setItem(TOKEN_KEY, res.token);
    storage.setItem(EXPIRES_KEY, res.expires);
    if (res.refreshToken) {
      storage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    }
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(EXPIRES_KEY);
    this.currentUser.set(null);
    this.status.set('anonymous');
  }

  private readStoredValue(key: string): string | null {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  }

  private getActiveStorage(): Storage | null {
    if (localStorage.getItem(TOKEN_KEY)) {
      return localStorage;
    }

    if (sessionStorage.getItem(TOKEN_KEY)) {
      return sessionStorage;
    }

    return null;
  }

  private buildAuthHeaders(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
