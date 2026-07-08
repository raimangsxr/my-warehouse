import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        {
          provide: ActivatedRoute,
          useValue: createActivatedRouteMock({}, { token: 'reset-token-from-query' })
        }
      ]
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create and prefill token from query params', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    expect(fixture.componentInstance.form.controls.token.value).toBe('reset-token-from-query');
  });

  it('submits new password and shows success message', () => {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ token: 'reset-token-from-query', newPassword: 'newpassword1' });
    component.submit();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/reset-password`);
    expect(req.request.body).toEqual({ token: 'reset-token-from-query', new_password: 'newpassword1' });
    req.flush({ message: 'Password updated' });

    expect(component.message).toBe('Password updated');
    expect(component.loading).toBe(false);
  });
});
