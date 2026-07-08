import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { testItem } from '../../testing/fixtures';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { ItemListComponent } from './item-list.component';

describe('ItemListComponent', () => {
  async function createList() {
    await TestBed.configureTestingModule({
      imports: [ItemListComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        { provide: ActivatedRoute, useValue: createActivatedRouteMock() }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(ItemListComponent);
    fixture.componentInstance.items = [testItem({ id: 'item-1', box_path: ['Root', 'Shelf'] })];
    fixture.componentInstance.boxPathIdsByItemId = { 'item-1': ['box-1', 'box-2'] };
    fixture.detectChanges();
    return fixture;
  }

  it('should create', async () => {
    const fixture = await createList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('enables path links when ids match path segments', async () => {
    const fixture = await createList();
    const component = fixture.componentInstance;
    const item = testItem({ box_path: ['Root', 'Shelf'] });

    component.showPathLinks = true;
    component.boxPathIdsByItemId = { [item.id]: ['box-1', 'box-2'] };
    expect(component.canLinkPath(item)).toBe(true);
    expect(component.pathIdsFor(item)).toEqual(['box-1', 'box-2']);
  });
});
