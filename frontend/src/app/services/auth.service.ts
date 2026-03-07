import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, finalize, of, shareReplay, tap, throwError } from 'rxjs';

import { environment } from '../core/environment';

export interface SignupPayload {
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  display_name: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly accessTokenKey = 'mw_access_token';
  private readonly refreshTokenKey = 'mw_refresh_token';
  private readonly persistentSessionKey = 'mw_persistent_session';
  private refreshRequest$?: Observable<TokenResponse>;

  constructor(private readonly http: HttpClient) {}

  signup(payload: SignupPayload): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${environment.apiBaseUrl}/auth/signup`, payload);
  }

  login(payload: LoginPayload): Observable<TokenResponse> {
    const rememberMe = !!payload.rememberMe;
    return this.http
      .post<TokenResponse>(
        `${environment.apiBaseUrl}/auth/login`,
        {
          email: payload.email,
          password: payload.password,
          remember_me: rememberMe
        },
        { withCredentials: true }
      )
      .pipe(tap((tokens) => this.persistTokens(tokens, rememberMe)));
  }

  me(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${environment.apiBaseUrl}/auth/me`);
  }

  forgotPassword(email: string): Observable<{ message: string; reset_token?: string }> {
    return this.http.post<{ message: string; reset_token?: string }>(
      `${environment.apiBaseUrl}/auth/forgot-password`,
      { email }
    );
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiBaseUrl}/auth/reset-password`, {
      token,
      new_password: newPassword
    });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiBaseUrl}/auth/change-password`, {
      current_password: currentPassword,
      new_password: newPassword
    });
  }

  logout(): Observable<{ message: string }> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken && !this.hasPersistentSession()) {
      this.clearTokens();
      return of({ message: 'Logged out' });
    }

    return this.http
      .post<{ message: string }>(
        `${environment.apiBaseUrl}/auth/logout`,
        refreshToken
          ? {
              refresh_token: refreshToken
            }
          : {},
        { withCredentials: true }
      )
      .pipe(tap(() => this.clearTokens()));
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  hasPersistentSession(): boolean {
    return localStorage.getItem(this.persistentSessionKey) === '1';
  }

  refreshSession(): Observable<TokenResponse> {
    if (!this.hasPersistentSession()) {
      return throwError(() => new Error('Persistent session is not enabled'));
    }

    if (!this.refreshRequest$) {
      const refreshToken = this.getRefreshToken();
      this.refreshRequest$ = this.http
        .post<TokenResponse>(
          `${environment.apiBaseUrl}/auth/refresh`,
          refreshToken
            ? {
                refresh_token: refreshToken,
                remember_me: true
              }
            : {
                remember_me: true
              },
          { withCredentials: true }
        )
        .pipe(
          tap((tokens) => this.persistTokens(tokens, true)),
          finalize(() => {
            this.refreshRequest$ = undefined;
          }),
          shareReplay(1)
        );
    }

    return this.refreshRequest$;
  }

  clearTokens(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.persistentSessionKey);
    this.refreshRequest$ = undefined;
  }

  private persistTokens(tokens: TokenResponse, rememberMe: boolean): void {
    localStorage.setItem(this.accessTokenKey, tokens.access_token);
    localStorage.setItem(this.refreshTokenKey, tokens.refresh_token);
    if (rememberMe) {
      localStorage.setItem(this.persistentSessionKey, '1');
    } else {
      localStorage.removeItem(this.persistentSessionKey);
    }
  }
}
