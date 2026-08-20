import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard } from './auth.guard';
import { provideCommonTestProviders } from '../../testing/test-helpers';

describe('authGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideCommonTestProviders(), AuthService]
    });
  });

  it('allows navigation when user is logged in', () => {
    localStorage.setItem('mw_access_token', 'token');

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/app/home' } as never));
    expect(result).toBe(true);
  });

  it('redirects to login with return url when user is logged out', () => {
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/app/home' } as never));
    const router = TestBed.inject(Router);

    expect(result).toEqual(router.parseUrl('/login?redirect=%2Fapp%2Fhome'));
  });
});

describe('guestGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideCommonTestProviders(), AuthService]
    });
  });

  it('allows guest routes when logged out', () => {
    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, { url: '/login' } as never));
    expect(result).toBe(true);
  });

  it('redirects authenticated users away from guest routes', () => {
    localStorage.setItem('mw_access_token', 'token');

    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, { url: '/login' } as never));
    const router = TestBed.inject(Router);

    expect(result).toEqual(router.parseUrl('/app'));
  });
});
