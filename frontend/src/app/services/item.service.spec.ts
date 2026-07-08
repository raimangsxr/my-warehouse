import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../core/environment';
import { ItemService } from './item.service';
import { configureServiceTest, flushHttp } from '../../testing/test-helpers';

describe('ItemService', () => {
  let service: ItemService;
  let httpMock: ReturnType<typeof configureServiceTest<ItemService>>['httpMock'];

  beforeEach(() => {
    ({ service, httpMock } = configureServiceTest(ItemService));
  });

  afterEach(() => {
    flushHttp(httpMock);
  });

  it('lists items with query params', () => {
    service
      .list('wh-1', { q: 'hammer', favoritesOnly: true, stockZero: true, withPhoto: true })
      .subscribe();

    const req = httpMock.expectOne((request) => request.url === `${environment.apiBaseUrl}/warehouses/wh-1/items`);
    expect(req.request.params.get('q')).toBe('hammer');
    expect(req.request.params.get('favorites_only')).toBe('true');
    expect(req.request.params.get('stock_zero')).toBe('true');
    expect(req.request.params.get('with_photo')).toBe('true');
    req.flush([]);
  });

  it('adjusts stock with command id', () => {
    service.adjustStock('wh-1', 'item-1', 1, 'cmd-1', 'restock').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/items/item-1/stock/adjust`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ delta: 1, command_id: 'cmd-1', note: 'restock' });
    req.flush({});
  });

  it('uploads item photo as multipart form', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    service.uploadPhoto('wh-1', file).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/photos/upload?warehouse_id=wh-1`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ photo_url: '/media/p.jpg', content_type: 'image/jpeg', size_bytes: 1 });
  });
});
