import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { NotificationService } from '../services/notification.service';
import { AcceptInviteComponent } from './accept-invite.component';

describe('AcceptInviteComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;
  let notificationService: NotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcceptInviteComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        { provide: ActivatedRoute, useValue: createActivatedRouteMock({ token: 'invite-token' }) }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    notificationService = TestBed.inject(NotificationService);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(notificationService, 'success');
    vi.spyOn(notificationService, 'error');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('accepts invite and selects warehouse', () => {
    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/invites/invite-token/accept`);
    req.flush({ message: 'ok', warehouse_id: 'wh-invited' });

    expect(fixture.componentInstance.successMessage).toContain('aceptada');
    expect(localStorage.getItem('mw_selected_warehouse_id')).toBe('wh-invited');
    expect(notificationService.success).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/home');
  });

  it('shows expired invite message on 400', () => {
    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/invites/invite-token/accept`);
    req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });

    expect(fixture.componentInstance.errorMessage).toContain('expirada');
    expect(notificationService.error).toHaveBeenCalled();
  });

  it('navigates to warehouses list', () => {
    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.componentInstance.goWarehouses();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/warehouses');
  });

  it('shows an invalid link message on 404', () => {
    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/invites/invite-token/accept`);
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });

    expect(fixture.componentInstance.errorMessage).toContain('no existe');
    expect(notificationService.error).toHaveBeenCalled();
  });
});
