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

  it('restores deleted box', () => {
    service.restore('wh-1', 'box-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/boxes/box-1/restore`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('gets a single box', () => {
    service.get('wh-1', 'box-1').subscribe((box) => {
      expect(box.name).toBe('Shelf A');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/boxes/box-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'box-1', name: 'Shelf A' });
  });

  it('updates a box', () => {
    service.update('wh-1', 'box-1', { name: 'Shelf B' }).subscribe((box) => {
      expect(box.name).toBe('Shelf B');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/boxes/box-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Shelf B' });
    req.flush({ id: 'box-1', name: 'Shelf B' });
  });

  it('deletes a box with force flag', () => {
    service.delete('wh-1', 'box-1', true).subscribe((response) => {
      expect(response.message).toBe('deleted');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/boxes/box-1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ force: true });
    req.flush({ message: 'deleted' });
  });

  it('lists recursive items with optional search', () => {
    service.listRecursiveItems('wh-1', 'box-1', 'hammer').subscribe();

    const req = httpMock.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/warehouses/wh-1/boxes/box-1/items`
    );
    expect(req.request.params.get('q')).toBe('hammer');
    req.flush([]);
  });

  it('resolves box by identifier', () => {
    service.resolveByIdentifier('A1').subscribe((lookup) => {
      expect(lookup.short_code).toBe('A1');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/boxes/resolve/A1`);
    expect(req.request.method).toBe('GET');
    req.flush({ box_id: 'b1', warehouse_id: 'wh-1', short_code: 'A1', name: 'Inbound' });
  });
});
