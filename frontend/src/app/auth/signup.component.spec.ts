import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { SignupComponent } from './signup.component';

describe('SignupComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        {
          provide: ActivatedRoute,
          useValue: createActivatedRouteMock({}, { redirect: '/invites/invite-token' })
        }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('signs up and auto-logs in before returning to the invite', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ email: 'new@example.com', password: 'password123' });
    component.submit();

    const signupReq = httpMock.expectOne(`${environment.apiBaseUrl}/auth/signup`);
    signupReq.flush({ id: '1', email: 'new@example.com', display_name: null });

    const loginReq = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    loginReq.flush({ access_token: 'a', refresh_token: 'r', token_type: 'bearer' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/invites/invite-token');
    expect(component.authRedirectQueryParams).toEqual({ redirect: '/invites/invite-token' });
    expect(component.loading).toBe(false);
  });

  it('shows error when signup fails', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ email: 'new@example.com', password: 'password123' });
    component.submit();

    const signupReq = httpMock.expectOne(`${environment.apiBaseUrl}/auth/signup`);
    signupReq.flush('Conflict', { status: 409, statusText: 'Conflict' });

    expect(component.errorMessage).toBe('No se pudo crear la cuenta.');
    expect(component.loading).toBe(false);
  });
});
