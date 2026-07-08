import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { routes } from '../routes';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { Item } from '../services/item.service';
import { ItemCardComponent } from './item-card.component';

const minimalItem: Item = {
  id: 'item-test',
  warehouse_id: 'wh-test',
  box_id: 'box-test',
  name: 'Test Item',
  description: null,
  photo_url: null,
  physical_location: null,
  tags: [],
  aliases: [],
  version: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  stock: 0,
  is_favorite: false,
  box_path: ['Root'],
  box_is_inbound: false
};

describe('ItemCardComponent', () => {
  it('should create', async () => {
    await TestBed.configureTestingModule({
      imports: [ItemCardComponent],
      providers: [
        provideRouter(routes),
        ...provideCommonTestProviders(),
        { provide: ActivatedRoute, useValue: createActivatedRouteMock() }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentInstance.item = minimalItem;
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
