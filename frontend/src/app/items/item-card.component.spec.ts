import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { testItem } from '../../testing/fixtures';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { ItemCardComponent } from './item-card.component';

describe('ItemCardComponent', () => {
  async function createCard() {
    await TestBed.configureTestingModule({
      imports: [ItemCardComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        { provide: ActivatedRoute, useValue: createActivatedRouteMock() }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(ItemCardComponent);
    fixture.componentInstance.item = testItem();
    return fixture;
  }

  it('should create', async () => {
    const fixture = await createCard();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('computes canLinkPath only with matching path ids', async () => {
    const fixture = await createCard();
    const component = fixture.componentInstance;
    component.showPathLinks = true;
    component.boxPathIds = ['box-1'];
    component.item = testItem({ box_path: ['Root', 'Shelf'] });

    expect(component.canLinkPath).toBe(false);

    component.boxPathIds = ['box-1', 'box-2'];
    expect(component.canLinkPath).toBe(true);
  });

  it('emits stock adjust events', async () => {
    const fixture = await createCard();
    const component = fixture.componentInstance;
    const spy = vi.fn();
    component.stockAdjust.subscribe(spy);

    component.stockAdjust.emit(1);
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('does not emit avatar preview events when disabled', async () => {
    const fixture = await createCard();
    const component = fixture.componentInstance;
    const clickSpy = vi.fn();
    component.avatarClick.subscribe(clickSpy);

    component.emitAvatarClick(new MouseEvent('click'));
    expect(clickSpy).not.toHaveBeenCalled();

    component.enablePhotoPreview = true;
    component.item = testItem({ photo_url: '/media/item.jpg' });
    component.emitAvatarClick(new MouseEvent('click'));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
