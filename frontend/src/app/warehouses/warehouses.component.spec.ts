import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

import { environment } from '../core/environment';
import { testWarehouse } from '../../testing/fixtures';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { NotificationService } from '../services/notification.service';
import { SyncService } from '../services/sync.service';
import { WarehousesComponent } from './warehouses.component';

describe('WarehousesComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;
  let notificationService: NotificationService;
  let syncService: SyncService;
  let dialog: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(false) })) };

    await TestBed.configureTestingModule({
      imports: [WarehousesComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        { provide: MatDialog, useValue: dialog }
      ]
    })
      .overrideProvider(MatDialog, { useValue: dialog })
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    notificationService = TestBed.inject(NotificationService);
    syncService = TestBed.inject(SyncService);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(notificationService, 'success');
    vi.spyOn(notificationService, 'error');
    vi.spyOn(notificationService, 'info');
    vi.spyOn(syncService, 'isOnline').mockReturnValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createComponent(): WarehousesComponent {
    const fixture = TestBed.createComponent(WarehousesComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`).flush({ id: 'user-1', email: 'a@b.com', display_name: null });
    httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`).flush([]);
    return component;
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('allows delete only for warehouses created by current user', () => {
    const component = createComponent();
    component.currentUserId = 'user-1';

    expect(component.canDeleteWarehouse(testWarehouse({ created_by: 'user-1' }))).toBe(true);
    expect(component.canDeleteWarehouse(testWarehouse({ created_by: 'user-2' }))).toBe(false);
  });

  it('opens warehouse and stores selection', () => {
    const component = createComponent();
    component.openWarehouse('wh-abc');

    expect(localStorage.getItem('mw_selected_warehouse_id')).toBe('wh-abc');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/home');
  });

  it('creates warehouse and navigates to app home', () => {
    const component = createComponent();
    component.form.setValue({ name: 'New WH' });
    component.createWarehouse();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`);
    expect(req.request.method).toBe('POST');
    req.flush(testWarehouse({ id: 'wh-new', name: 'New WH' }));

    httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`).flush([testWarehouse({ id: 'wh-new', name: 'New WH' })]);

    expect(notificationService.success).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/home');
  });

  it('blocks delete confirmation when offline', () => {
    vi.spyOn(syncService, 'isOnline').mockReturnValue(false);
    const component = createComponent();
    component.confirmDeleteWarehouse(testWarehouse());

    expect(dialog.open).not.toHaveBeenCalled();
    expect(notificationService.error).toHaveBeenCalledWith('Necesitas conexión a internet para eliminar un almacén.');
  });

  it('maps delete API errors to user-facing messages', () => {
    const component = createComponent();
    component.currentUserId = 'user-1';

    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    component.confirmDeleteWarehouse(testWarehouse({ id: 'wh-del', name: 'Main', created_by: 'user-1' }));

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-del`);
    req.flush(
      { detail: 'Confirmation name does not match warehouse name' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(component.errorMessage).toBe('El nombre de confirmación no coincide.');
    expect(notificationService.error).toHaveBeenCalledWith('El nombre de confirmación no coincide.');
  });

  it('creates invite successfully', () => {
    const component = createComponent();
    component.inviteForm.setValue({ warehouseId: 'wh-test', email: 'guest@example.com' });
    component.createInvite();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/invites`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'guest@example.com' });
    req.flush({
      warehouse_id: 'wh-test',
      invite_token: 'token-abc',
      invite_url: 'https://app.test/invites/token-abc',
      expires_at: '2026-12-31T00:00:00.000Z',
      email_delivery_status: 'sent',
      email_delivery_message: 'Invitación enviada por correo.'
    });

    expect(component.inviteMessage).toBe('Invitación enviada por correo.');
    expect(component.inviteLink).toBe('https://app.test/invites/token-abc');
    expect(notificationService.success).toHaveBeenCalledWith('Invitación enviada por correo.');
  });

  it('keeps the manual invite link when email delivery fails', () => {
    const component = createComponent();
    component.inviteForm.setValue({ warehouseId: 'wh-test', email: 'guest@example.com' });
    component.createInvite();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/invites`);
    req.flush({
      warehouse_id: 'wh-test',
      invite_token: 'token-fallback',
      invite_url: 'https://app.test/invites/token-fallback',
      expires_at: '2026-12-31T00:00:00.000Z',
      email_delivery_status: 'failed',
      email_delivery_message: 'Invitación creada, pero no se pudo enviar el correo.'
    });

    expect(component.inviteMessage).toContain('no se pudo enviar');
    expect(component.inviteLink).toBe('https://app.test/invites/token-fallback');
    expect(notificationService.info).toHaveBeenCalledWith(component.inviteMessage);
  });

  it('deletes warehouse successfully after confirmation', async () => {
    vi.spyOn(syncService, 'purgeWarehouse').mockResolvedValue();
    localStorage.setItem('mw_selected_warehouse_id', 'wh-del');

    const component = createComponent();
    component.currentUserId = 'user-1';
    component.warehouses = [testWarehouse({ id: 'wh-del', name: 'Main', created_by: 'user-1' })];

    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    component.confirmDeleteWarehouse(testWarehouse({ id: 'wh-del', name: 'Main', created_by: 'user-1' }));

    const deleteReq = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-del`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({ message: 'deleted' });

    await vi.waitFor(() => {
      expect(syncService.purgeWarehouse).toHaveBeenCalledWith('wh-del');
    });

    httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`).flush([]);

    expect(localStorage.getItem('mw_selected_warehouse_id')).toBeNull();
    expect(notificationService.success).toHaveBeenCalledWith('Almacén eliminado correctamente.');
    expect(component.deletingWarehouseId).toBeNull();
  });
});
