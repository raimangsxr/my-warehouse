import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../core/environment';
import { BoxService } from './box.service';
import { configureServiceTest, flushHttp } from '../../testing/test-helpers';

describe('BoxService', () => {
  let service: BoxService;
  let httpMock: ReturnType<typeof configureServiceTest<BoxService>>['httpMock'];

  beforeEach(() => {
    ({ service, httpMock } = configureServiceTest(BoxService));
  });

  afterEach(() => {
    flushHttp(httpMock);
  });

  it('loads box tree', () => {
    service.tree('wh-1', true).subscribe();

    const req = httpMock.expectOne((request) => request.url === `${environment.apiBaseUrl}/warehouses/wh-1/boxes/tree`);
    expect(req.request.params.get('include_deleted')).toBe('true');
    req.flush([]);
  });

  it('moves a box under a new parent', () => {
    service.move('wh-1', 'box-1', 'box-2').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/boxes/box-1/move`);
    expect(req.request.body).toEqual({ new_parent_box_id: 'box-2' });
    req.flush({});
  });

  it('resolves box by qr token', () => {
    service.resolveByQrToken('qr-token').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/boxes/by-qr/qr-token`);
    expect(req.request.method).toBe('GET');
    req.flush({ box_id: 'b1', warehouse_id: 'wh-1', short_code: 'A1', name: 'Inbound' });
  });
});
