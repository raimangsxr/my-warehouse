import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../core/environment';
import { TransferService } from './transfer.service';
import { configureServiceTest, flushHttp } from '../../testing/test-helpers';

describe('TransferService', () => {
  let service: TransferService;
  let httpMock: ReturnType<typeof configureServiceTest<TransferService>>['httpMock'];

  beforeEach(() => {
    ({ service, httpMock } = configureServiceTest(TransferService));
  });

  afterEach(() => {
    flushHttp(httpMock);
  });

  it('exports warehouse payload', () => {
    service.exportWarehouse('wh-1').subscribe((payload) => {
      expect(payload.warehouse.id).toBe('wh-1');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/export`);
    expect(req.request.method).toBe('GET');
    req.flush({
      schema_version: 1,
      exported_at: '2026-01-01',
      warehouse: { id: 'wh-1', name: 'Main' },
      boxes: [],
      items: [],
      stock_movements: []
    });
  });

  it('imports warehouse payload', () => {
    const payload = {
      schema_version: 1,
      exported_at: '2026-01-01',
      warehouse: { id: 'wh-1', name: 'Main' },
      boxes: [],
      items: [],
      stock_movements: []
    };

    service.importWarehouse('wh-1', payload).subscribe((response) => {
      expect(response.message).toBe('ok');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/import`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ message: 'ok', boxes_upserted: 0, items_upserted: 0, stock_movements_upserted: 0 });
  });
});
