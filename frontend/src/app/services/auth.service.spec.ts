import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { environment } from '../core/environment';
import { AuthService } from './auth.service';
import { configureServiceTest, flushHttp } from '../../testing/test-helpers';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: ReturnType<typeof configureServiceTest<AuthService>>['httpMock'];

  beforeEach(() => {
    ({ service, httpMock } = configureServiceTest(AuthService));
  });

  afterEach(() => {
    flushHttp(httpMock);
  });

  it('signup posts credentials', () => {
    const payload = { email: 'a@b.com', password: 'secret' };
    service.signup(payload).subscribe((user) => {
      expect(user.email).toBe(payload.email);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/signup`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: '1', email: payload.email, display_name: null, default_warehouse_id: null });
  });

  it('login persists tokens and remember-me flag', () => {
    service
      .login({ email: 'a@b.com', password: 'secret', rememberMe: true })
      .subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.body).toEqual({
      email: 'a@b.com',
      password: 'secret',
      remember_me: true
    });
    req.flush({ access_token: 'access', refresh_token: 'refresh', token_type: 'bearer' });

    expect(service.getAccessToken()).toBe('access');
    expect(service.getRefreshToken()).toBe('refresh');
    expect(service.hasPersistentSession()).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
  });

  it('logout clears tokens locally when no refresh token', () => {
    localStorage.setItem('mw_access_token', 'access');

    service.logout().subscribe((response) => {
      expect(response.message).toBe('Logged out');
    });

    httpMock.expectNone(`${environment.apiBaseUrl}/auth/logout`);
    expect(service.getAccessToken()).toBeNull();
  });

  it('refreshSession fails without persistent session', () => {
    let error: Error | undefined;
    service.refreshSession().subscribe({
      error: (err) => {
        error = err as Error;
      }
    });
    expect(error?.message).toBe('Persistent session is not enabled');
  });

  it('clearTokens removes stored credentials', () => {
    localStorage.setItem('mw_access_token', 'a');
    localStorage.setItem('mw_refresh_token', 'r');
    localStorage.setItem('mw_persistent_session', '1');

    service.clearTokens();

    expect(service.isLoggedIn()).toBe(false);
    expect(service.hasPersistentSession()).toBe(false);
  });

  it('loads current user profile', () => {
    service.me().subscribe((user) => {
      expect(user.email).toBe('a@b.com');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
    req.flush({ id: '1', email: 'a@b.com', display_name: 'Ana', default_warehouse_id: null });
    expect(service.currentUser()?.email).toBe('a@b.com');
  });

  it('updates profile and default warehouse in reactive account state', () => {
    service.updateProfile('Ana').subscribe();
    const profile = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
    expect(profile.request.method).toBe('PATCH');
    profile.flush({ id: '1', email: 'a@b.com', display_name: 'Ana', default_warehouse_id: null });

    service.setDefaultWarehouse('wh-1').subscribe();
    const preferred = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me/default-warehouse`);
    expect(preferred.request.method).toBe('PUT');
    expect(preferred.request.body).toEqual({ warehouse_id: 'wh-1' });
    preferred.flush({ id: '1', email: 'a@b.com', display_name: 'Ana', default_warehouse_id: 'wh-1' });

    expect(service.currentUser()?.default_warehouse_id).toBe('wh-1');
  });

  it('logs out through API when refresh token exists', () => {
    localStorage.setItem('mw_refresh_token', 'refresh');

    service.logout().subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/logout`);
    expect(req.request.body).toEqual({ refresh_token: 'refresh' });
    req.flush({ message: 'ok' });

    expect(service.getRefreshToken()).toBeNull();
  });

  it('refreshes session when persistent login is enabled', () => {
    localStorage.setItem('mw_refresh_token', 'refresh');
    localStorage.setItem('mw_persistent_session', '1');

    service.refreshSession().subscribe((tokens) => {
      expect(tokens.access_token).toBe('new-access');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/refresh`);
    req.flush({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'bearer' });
    expect(service.getAccessToken()).toBe('new-access');
  });

  it('forgotPassword posts email', () => {
    service.forgotPassword('a@b.com').subscribe((response) => {
      expect(response.message).toBe('Check your email');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/forgot-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.com' });
    req.flush({ message: 'Check your email' });
  });

  it('resetPassword posts token and new password', () => {
    service.resetPassword('reset-token', 'new-secret').subscribe((response) => {
      expect(response.message).toBe('Password updated');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/reset-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'reset-token', new_password: 'new-secret' });
    req.flush({ message: 'Password updated' });
  });

  it('changePassword posts current and new password', () => {
    service.changePassword('old-secret', 'new-secret').subscribe((response) => {
      expect(response.message).toBe('Password changed');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/change-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ current_password: 'old-secret', new_password: 'new-secret' });
    req.flush({ message: 'Password changed' });
  });
});
