import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from './environment';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthService
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('adds bearer token to outgoing requests', () => {
    localStorage.setItem('mw_access_token', 'access-token');

    http.get(`${environment.apiBaseUrl}/auth/me`).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token');
    req.flush({ id: '1', email: 'a@b.com', display_name: null });
  });

  it('clears tokens and redirects on unauthorized protected requests', () => {
    localStorage.setItem('mw_access_token', 'access-token');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get(`${environment.apiBaseUrl}/warehouses`).subscribe({ error: () => undefined });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authService.getAccessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { redirect: '/' } });
  });

  it('attempts refresh on 401 when persistent session is enabled', () => {
    localStorage.setItem('mw_access_token', 'old-access');
    localStorage.setItem('mw_refresh_token', 'refresh');
    localStorage.setItem('mw_persistent_session', '1');

    http.get(`${environment.apiBaseUrl}/warehouses`).subscribe();

    const firstReq = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`);
    firstReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne(`${environment.apiBaseUrl}/auth/refresh`);
    refreshReq.flush({ access_token: 'new-access', refresh_token: 'refresh', token_type: 'bearer' });

    const retryReq = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`);
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-access');
    retryReq.flush([]);
  });
});
