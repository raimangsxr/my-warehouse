import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationService } from '../services/notification.service';
import { WarehouseService } from '../services/warehouse.service';
import { warehouseSelectedGuard } from './warehouse.guard';

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

    expect(result).toEqual(router.parseUrl('/warehouses'));
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
    expect(result).toEqual(router.parseUrl('/warehouses'));
  });

  it('allows navigation when warehouse list fails', async () => {
    vi.mocked(warehouseService.getSelectedWarehouseId).mockReturnValue('wh-1');
    vi.mocked(warehouseService.list).mockReturnValue(throwError(() => new Error('network')));

    const result = await TestBed.runInInjectionContext(() => warehouseSelectedGuard({} as never, { url: '/app' } as never));
    expect(result).toBe(true);
  });
});
