import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

import { environment } from '../core/environment';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        {
          provide: ActivatedRoute,
          useValue: createActivatedRouteMock({}, { redirect: '/app/home' })
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

  it('should create', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('does not submit when form is invalid', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.submit();
    httpMock.expectNone(`${environment.apiBaseUrl}/auth/login`);
    expect(component.loading).toBe(false);
  });

  it('logs in and navigates to redirect url', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ email: 'user@example.com', password: 'password123', rememberMe: true });
    component.submit();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.body.remember_me).toBe(true);
    req.flush({ access_token: 'a', refresh_token: 'r', token_type: 'bearer' });

    expect(component.loading).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/home');
  });

  it('shows error message when login fails', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ email: 'user@example.com', password: 'password123', rememberMe: false });
    component.submit();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(component.errorMessage).toContain('No se pudo iniciar sesión');
    expect(component.loading).toBe(false);
  });
});
