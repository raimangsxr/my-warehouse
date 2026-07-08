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
    req.flush({ id: '1', email: payload.email, display_name: null });
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
});
