import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationService } from '../services/notification.service';
import { WarehouseService } from '../services/warehouse.service';
import { warehouseAdministratorGuard } from './warehouse-admin.guard';

describe('warehouseAdministratorGuard', () => {
  let warehouseService: WarehouseService;
  let notificationService: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: WarehouseService,
          useValue: {
            getSelectedWarehouseId: vi.fn(() => 'wh-1'),
            list: vi.fn(),
            isSelectedWarehouseAdministrator: vi.fn(() => false),
          },
        },
        { provide: NotificationService, useValue: { error: vi.fn() } },
      ],
    });
    warehouseService = TestBed.inject(WarehouseService);
    notificationService = TestBed.inject(NotificationService);
  });

  it('allows an administrator', async () => {
    vi.mocked(warehouseService.list).mockReturnValue(of([
      { id: 'wh-1', name: 'Main', created_by: 'u1', created_at: '2026-01-01', role: 'administrator' },
    ]));

    const result = await TestBed.runInInjectionContext(() =>
      warehouseAdministratorGuard({} as never, { url: '/app/settings' } as never)
    );
    expect(result).toBe(true);
  });

  it('redirects and notifies a contributor', async () => {
    vi.mocked(warehouseService.list).mockReturnValue(of([
      { id: 'wh-1', name: 'Main', created_by: 'u1', created_at: '2026-01-01', role: 'contributor' },
    ]));

    const result = await TestBed.runInInjectionContext(() =>
      warehouseAdministratorGuard({} as never, { url: '/app/settings' } as never)
    );
    const router = TestBed.inject(Router);
    expect(notificationService.error).toHaveBeenCalled();
    expect(result).toEqual(router.parseUrl('/app/home'));
  });

  it('uses the last validated administrator role on a network error', async () => {
    vi.mocked(warehouseService.list).mockReturnValue(throwError(() => new Error('offline')));
    vi.mocked(warehouseService.isSelectedWarehouseAdministrator).mockReturnValue(true);

    const result = await TestBed.runInInjectionContext(() =>
      warehouseAdministratorGuard({} as never, { url: '/app/settings' } as never)
    );
    expect(result).toBe(true);
  });
});
