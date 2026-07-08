import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { testItem } from '../../testing/fixtures';
import { environment } from '../core/environment';
import { createStandaloneComponent } from '../../testing/component-test-helpers';
import { NotificationService } from '../services/notification.service';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
  });

  afterEach(() => {
    if (httpMock) {
      httpMock.verify();
    }
  });

  async function createHome() {
    const fixture = await createStandaloneComponent(HomeComponent);
    httpMock = TestBed.inject(HttpTestingController);

    // Initial ngOnInit requests
    httpMock.expectOne((request) => request.url.includes('/tags/cloud')).flush([]);
    httpMock.expectOne((request) => request.url.includes('/boxes/tree')).flush([]);
    httpMock.expectOne((request) => request.url.includes('/items')).flush([]);

    return fixture;
  }

  it('should create', async () => {
    const fixture = await createHome();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('persists selected view mode in localStorage', async () => {
    const fixture = await createHome();
    const component = fixture.componentInstance;

    component.setViewMode('list');
    expect(localStorage.getItem('home_view_mode')).toBe('list');
    expect(component.viewMode).toBe('list');
  });

  it('toggles batch selection state', async () => {
    const fixture = await createHome();
    const component = fixture.componentInstance;

    component.toggleBatchActions();
    expect(component.batchActionsExpanded).toBe(true);

    component.toggleSelected('item-1');
    expect(component.selectedItemIds.has('item-1')).toBe(true);

    component.toggleBatchActions();
    expect(component.batchActionsExpanded).toBe(false);
    expect(component.selectedItemIds.size).toBe(0);
  });

  it('toggles active tag filter', async () => {
    const fixture = await createHome();
    const component = fixture.componentInstance;

    component.toggleTag('tools');
    expect(component.activeTag).toBe('tools');

    httpMock.expectOne((request) => request.url.includes('/items')).flush([]);

    component.toggleTag('tools');
    expect(component.activeTag).toBeNull();
    httpMock.expectOne((request) => request.url.includes('/items')).flush([]);
  });

  it('updates favorite state after API success', async () => {
    const fixture = await createHome();
    const component = fixture.componentInstance;
    const item = testItem({ id: 'item-1', is_favorite: false });
    component.items = [item];

    component.toggleFavorite(item);

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/items/item-1/favorite`);
    req.flush(testItem({ id: 'item-1', is_favorite: true }));

    expect(component.items[0].is_favorite).toBe(true);
  });

  it('adjusts stock after API success', async () => {
    const fixture = await createHome();
    const component = fixture.componentInstance;
    const item = testItem({ id: 'item-1', stock: 3 });
    component.items = [item];

    component.adjustStock(item, 1);

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/items/item-1/stock/adjust`);
    expect(req.request.body).toMatchObject({ delta: 1 });
    req.flush(testItem({ id: 'item-1', stock: 4 }));

    expect(component.items[0].stock).toBe(4);
  });

  it('deletes item after confirmation', async () => {
    const fixture = await createHome();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const item = testItem({ id: 'item-del', name: 'To delete' });
    component.items = [item];
    component.selectedItemIds.add(item.id);

    component.deleteItem(item);

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/items/item-del`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'deleted' });

    expect(component.items).toEqual([]);
    expect(component.selectedItemIds.has(item.id)).toBe(false);
    expect(notificationService.success).toHaveBeenCalledWith('Artículo enviado a papelera.');
  });

  it('toggles quick filter controls', async () => {
    const fixture = await createHome();
    const component = fixture.componentInstance;

    expect(component.filtersForm.controls.favoritesOnly.value).toBe(false);
    component.toggleQuickFilter('favoritesOnly');
    expect(component.filtersForm.controls.favoritesOnly.value).toBe(true);

    component.toggleQuickFilter('stockZero');
    expect(component.filtersForm.controls.stockZero.value).toBe(true);
  });

  it('batch moves selected items to target box', async () => {
    const fixture = await createHome();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');

    component.selectedItemIds.add('item-1');
    component.selectedItemIds.add('item-2');
    component.targetBoxId = 'box-target';
    component.batchMove();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/items/batch`);
    expect(req.request.body).toEqual({
      item_ids: ['item-1', 'item-2'],
      action: 'move',
      target_box_id: 'box-target'
    });
    req.flush({ message: 'ok' });
    httpMock.expectOne((request) => request.url.includes('/items')).flush([]);

    expect(notificationService.success).toHaveBeenCalledWith('Lote movido correctamente.');
  });

  it('batch deletes selected items after confirmation', async () => {
    const fixture = await createHome();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.selectedItemIds.add('item-1');
    component.batchDelete();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/items/batch`);
    expect(req.request.body).toEqual({
      item_ids: ['item-1'],
      action: 'delete'
    });
    req.flush({ message: 'ok' });
    httpMock.expectOne((request) => request.url.includes('/items')).flush([]);

    expect(notificationService.success).toHaveBeenCalledWith('Lote enviado a papelera.');
  });

  it('batch favorites selected items', async () => {
    const fixture = await createHome();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');

    component.selectedItemIds.add('item-1');
    component.batchFavorite(true);

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/items/batch`);
    expect(req.request.body).toEqual({
      item_ids: ['item-1'],
      action: 'favorite'
    });
    req.flush({ message: 'ok' });
    httpMock.expectOne((request) => request.url.includes('/items')).flush([]);

    expect(notificationService.success).toHaveBeenCalledWith('Favoritos del lote actualizados.');
  });
});
