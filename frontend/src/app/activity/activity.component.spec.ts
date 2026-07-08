import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../core/environment';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { ActivityComponent } from './activity.component';

describe('ActivityComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');

    await TestBed.configureTestingModule({
      imports: [ActivityComponent],
      providers: provideCommonTestProviders()
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads activity events for selected warehouse', () => {
    const fixture = TestBed.createComponent(ActivityComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((request) => request.url === `${environment.apiBaseUrl}/warehouses/wh-test/activity`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush([
      {
        id: 'evt-1',
        warehouse_id: 'wh-test',
        actor_user_id: 'user-1',
        event_type: 'item.created',
        entity_type: 'item',
        entity_id: 'item-1',
        metadata: {},
        created_at: '2026-01-01T00:00:00.000Z'
      }
    ]);

    expect(fixture.componentInstance.events).toHaveLength(1);
  });

  it('shows error when warehouse is not selected', () => {
    localStorage.removeItem('mw_selected_warehouse_id');
    const fixture = TestBed.createComponent(ActivityComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.errorMessage).toBe('Selecciona un warehouse.');
    httpMock.expectNone(`${environment.apiBaseUrl}/warehouses/wh-test/activity`);
  });
});
