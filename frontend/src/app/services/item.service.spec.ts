import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../core/environment';
import { testItem } from '../../testing/fixtures';
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

  it('creates and restores items', () => {
    service.create('wh-1', { box_id: 'box-1', name: 'Hammer' }).subscribe();
    let req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/items`);
    expect(req.request.method).toBe('POST');
    req.flush(testItem({ id: 'item-new', name: 'Hammer' }));

    service.restore('wh-1', 'item-new').subscribe();
    req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/items/item-new/restore`);
    expect(req.request.method).toBe('POST');
    req.flush(testItem({ id: 'item-new', deleted_at: null }));
  });

  it('runs batch favorite action', () => {
    service.batch('wh-1', { item_ids: ['i1', 'i2'], action: 'favorite' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/items/batch`);
    expect(req.request.body).toEqual({ item_ids: ['i1', 'i2'], action: 'favorite' });
    req.flush({ message: 'ok' });
  });

  it('gets a single item', () => {
    service.get('wh-1', 'item-1').subscribe((item) => {
      expect(item.name).toBe('Hammer');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/items/item-1`);
    expect(req.request.method).toBe('GET');
    req.flush(testItem({ id: 'item-1', name: 'Hammer' }));
  });

  it('loads tags cloud', () => {
    service.tagsCloud('wh-1').subscribe((tags) => {
      expect(tags).toHaveLength(1);
      expect(tags[0].tag).toBe('tools');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/tags/cloud`);
    expect(req.request.method).toBe('GET');
    req.flush([{ tag: 'tools', count: 3 }]);
  });

  it('drafts item fields from photo', () => {
    service.draftFromPhoto('wh-1', 'data:image/jpeg;base64,abc').subscribe((draft) => {
      expect(draft.name).toBe('Hammer');
      expect(draft.llm_used).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/items/draft-from-photo`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ image_data_url: 'data:image/jpeg;base64,abc' });
    req.flush({
      name: 'Hammer',
      description: null,
      tags: ['tools'],
      aliases: [],
      confidence: 0.9,
      warnings: [],
      llm_used: true
    });
  });

  it('updates an item', () => {
    service.update('wh-1', 'item-1', { name: 'Updated Hammer' }).subscribe((item) => {
      expect(item.name).toBe('Updated Hammer');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/items/item-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Updated Hammer' });
    req.flush(testItem({ id: 'item-1', name: 'Updated Hammer' }));
  });

  it('deletes an item', () => {
    service.delete('wh-1', 'item-1').subscribe((response) => {
      expect(response.message).toBe('deleted');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/items/item-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'deleted' });
  });

  it('sets favorite flag', () => {
    service.setFavorite('wh-1', 'item-1', true).subscribe((item) => {
      expect(item.is_favorite).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/items/item-1/favorite`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ is_favorite: true });
    req.flush(testItem({ id: 'item-1', is_favorite: true }));
  });
});
