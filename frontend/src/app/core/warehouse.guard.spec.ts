import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';
import { WarehouseService } from '../services/warehouse.service';
import { warehouseEntryGuard, warehouseSelectedGuard } from './warehouse.guard';

describe('warehouseSelectedGuard', () => {
  let warehouseService: WarehouseService;
  let notificationService: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: WarehouseService,
          useValue: {
            getSelectedWarehouseId: vi.fn(),
            list: vi.fn(),
            clearSelectedWarehouseId: vi.fn()
          }
        },
        {
          provide: NotificationService,
          useValue: {
            error: vi.fn()
          }
        }
      ]
    });

    warehouseService = TestBed.inject(WarehouseService);
    notificationService = TestBed.inject(NotificationService);
  });

  it('redirects to warehouses when none is selected', async () => {
    vi.mocked(warehouseService.getSelectedWarehouseId).mockReturnValue(null);

    const result = await TestBed.runInInjectionContext(() => warehouseSelectedGuard({} as never, { url: '/app' } as never));
    const router = TestBed.inject(Router);

    expect(result).toEqual(router.parseUrl('/app'));
  });

  it('allows navigation when selected warehouse still exists', async () => {
    vi.mocked(warehouseService.getSelectedWarehouseId).mockReturnValue('wh-1');
    vi.mocked(warehouseService.list).mockReturnValue(
      of([{ id: 'wh-1', name: 'Main', created_by: 'u1', created_at: '2026-01-01', role: 'administrator' }])
    );

    const result = await TestBed.runInInjectionContext(() => warehouseSelectedGuard({} as never, { url: '/app' } as never));
    expect(result).toBe(true);
  });

  it('clears stale selection and notifies when warehouse disappeared', async () => {
    vi.mocked(warehouseService.getSelectedWarehouseId).mockReturnValue('wh-1');
    vi.mocked(warehouseService.list).mockReturnValue(of([]));

    const result = await TestBed.runInInjectionContext(() => warehouseSelectedGuard({} as never, { url: '/app' } as never));
    const router = TestBed.inject(Router);

    expect(warehouseService.clearSelectedWarehouseId).toHaveBeenCalled();
    expect(notificationService.error).toHaveBeenCalledWith('Este almacén ya no está disponible.');
    expect(result).toEqual(router.parseUrl('/app'));
  });

  it('allows navigation when warehouse list fails', async () => {
    vi.mocked(warehouseService.getSelectedWarehouseId).mockReturnValue('wh-1');
    vi.mocked(warehouseService.list).mockReturnValue(throwError(() => new Error('network')));

    const result = await TestBed.runInInjectionContext(() => warehouseSelectedGuard({} as never, { url: '/app' } as never));
    expect(result).toBe(true);
  });
});

describe('warehouseEntryGuard', () => {
  let authService: { me: ReturnType<typeof vi.fn>; setDefaultWarehouse: ReturnType<typeof vi.fn> };
  let warehouseService: {
    list: ReturnType<typeof vi.fn>;
    setSelectedWarehouseId: ReturnType<typeof vi.fn>;
    clearSelectedWarehouseId: ReturnType<typeof vi.fn>;
    getSelectedWarehouseId: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authService = { me: vi.fn(), setDefaultWarehouse: vi.fn() };
    warehouseService = {
      list: vi.fn(), setSelectedWarehouseId: vi.fn(), clearSelectedWarehouseId: vi.fn(), getSelectedWarehouseId: vi.fn()
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: WarehouseService, useValue: warehouseService },
        { provide: NotificationService, useValue: { info: vi.fn(), error: vi.fn() } },
      ]
    });
  });

  it('opens the valid account default', async () => {
    authService.me.mockReturnValue(of({ id: 'u1', email: 'u@example.com', display_name: null, default_warehouse_id: 'wh-2' }));
    warehouseService.list.mockReturnValue(of([
      { id: 'wh-1', name: 'Old', created_by: 'u1', created_at: '2026-01-01', membership_created_at: '2026-01-01', role: 'administrator' },
      { id: 'wh-2', name: 'Default', created_by: 'u1', created_at: '2026-01-02', membership_created_at: '2026-01-02', role: 'contributor' },
    ]));

    const result = await TestBed.runInInjectionContext(() => warehouseEntryGuard({} as never, {} as never));
    expect(warehouseService.setSelectedWarehouseId).toHaveBeenCalledWith('wh-2');
    expect(result).toEqual(TestBed.inject(Router).parseUrl('/app/home'));
  });

  it('uses and persists the oldest membership when the default is missing', async () => {
    authService.me.mockReturnValue(of({ id: 'u1', email: 'u@example.com', display_name: null, default_warehouse_id: null }));
    warehouseService.list.mockReturnValue(of([
      { id: 'wh-new', name: 'New', created_by: 'u1', created_at: '2026-02-01', membership_created_at: '2026-02-01', role: 'contributor' },
      { id: 'wh-old', name: 'Old', created_by: 'u1', created_at: '2026-01-01', membership_created_at: '2026-01-01', role: 'administrator' },
    ]));
    authService.setDefaultWarehouse.mockReturnValue(of({ default_warehouse_id: 'wh-old' }));

    await TestBed.runInInjectionContext(() => warehouseEntryGuard({} as never, {} as never));
    expect(warehouseService.setSelectedWarehouseId).toHaveBeenCalledWith('wh-old');
    expect(authService.setDefaultWarehouse).toHaveBeenCalledWith('wh-old');
  });

  it('routes users without memberships to integrated warehouses', async () => {
    authService.me.mockReturnValue(of({ id: 'u1', email: 'u@example.com', display_name: null, default_warehouse_id: null }));
    warehouseService.list.mockReturnValue(of([]));

    const result = await TestBed.runInInjectionContext(() => warehouseEntryGuard({} as never, {} as never));
    expect(result).toEqual(TestBed.inject(Router).parseUrl('/app/warehouses'));
  });
});
