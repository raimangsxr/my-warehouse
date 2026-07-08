import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../core/environment';
import { WarehouseService } from './warehouse.service';
import { configureServiceTest, flushHttp } from '../../testing/test-helpers';

describe('WarehouseService', () => {
  let service: WarehouseService;
  let httpMock: ReturnType<typeof configureServiceTest<WarehouseService>>['httpMock'];

  beforeEach(() => {
    ({ service, httpMock } = configureServiceTest(WarehouseService));
  });

  afterEach(() => {
    flushHttp(httpMock);
  });

  it('lists warehouses', () => {
    service.list().subscribe((warehouses) => {
      expect(warehouses).toHaveLength(1);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'wh-1', name: 'Main', created_by: 'u1', created_at: '2026-01-01' }]);
  });

  it('creates a warehouse', () => {
    service.create('Secondary').subscribe((warehouse) => {
      expect(warehouse.name).toBe('Secondary');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Secondary' });
    req.flush({ id: 'wh-2', name: 'Secondary', created_by: 'u1', created_at: '2026-01-02' });
  });

  it('deletes a warehouse with confirmation name', () => {
    service.delete('wh-1', 'Main').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ confirm_name: 'Main' });
    req.flush({ message: 'deleted' });
  });

  it('stores selected warehouse id in localStorage', () => {
    service.setSelectedWarehouseId('wh-1');
    expect(service.getSelectedWarehouseId()).toBe('wh-1');

    service.clearSelectedWarehouseId();
    expect(service.getSelectedWarehouseId()).toBeNull();
  });
});
