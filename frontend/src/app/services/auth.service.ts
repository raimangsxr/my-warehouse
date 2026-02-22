import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../core/environment';

export interface SignupPayload {
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
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

  constructor(private readonly http: HttpClient) {}

  signup(payload: SignupPayload): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${environment.apiBaseUrl}/auth/signup`, payload);
  }

  login(payload: LoginPayload): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${environment.apiBaseUrl}/auth/login`, payload)
      .pipe(tap((tokens) => this.persistTokens(tokens)));
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
    if (!refreshToken) {
      this.clearTokens();
      return new Observable((subscriber) => {
        subscriber.next({ message: 'Logged out' });
        subscriber.complete();
      });
    }

    return this.http
      .post<{ message: string }>(`${environment.apiBaseUrl}/auth/logout`, {
        refresh_token: refreshToken
      })
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

  clearTokens(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
  }

  private persistTokens(tokens: TokenResponse): void {
    localStorage.setItem(this.accessTokenKey, tokens.access_token);
    localStorage.setItem(this.refreshTokenKey, tokens.refresh_token);
  }
}
