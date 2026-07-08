import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { testItem } from '../../testing/fixtures';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { NotificationService } from '../services/notification.service';
import { TrashComponent } from './trash.component';

describe('TrashComponent', () => {
  let httpMock: HttpTestingController;
  let notificationService: NotificationService;

  beforeEach(async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');

    await TestBed.configureTestingModule({
      imports: [TrashComponent],
      providers: provideCommonTestProviders()
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads deleted boxes and items on init', () => {
    const fixture = TestBed.createComponent(TrashComponent);
    fixture.detectChanges();

    httpMock
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/warehouses/wh-test/boxes/tree`)
      .flush([]);
    httpMock
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/warehouses/wh-test/items`)
      .flush([testItem({ deleted_at: '2026-01-02T00:00:00.000Z' })]);

    expect(fixture.componentInstance.deletedItems).toHaveLength(1);
  });

  it('restores deleted item', () => {
    const fixture = TestBed.createComponent(TrashComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne((request) => request.url.includes('/boxes/tree')).flush([]);
    httpMock.expectOne((request) => request.url.includes('/items')).flush([testItem({ id: 'item-1', deleted_at: '2026-01-02' })]);

    component.restoreItem('item-1');

    const restoreReq = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/items/item-1/restore`);
    restoreReq.flush(testItem({ id: 'item-1', deleted_at: null }));

    httpMock.expectOne((request) => request.url.includes('/boxes/tree')).flush([]);
    httpMock.expectOne((request) => request.url.includes('/items')).flush([]);

    expect(notificationService.success).toHaveBeenCalled();
  });
});
