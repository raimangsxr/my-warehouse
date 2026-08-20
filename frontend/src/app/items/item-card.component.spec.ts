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

  it('cancels an action after a touch movement of twelve pixels', async () => {
    const fixture = await createCard();
    const component = fixture.componentInstance;
    const spy = vi.fn();
    component.stockAdjust.subscribe(spy);

    component.onPointerDown({ pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 10 } as PointerEvent);
    component.onPointerMove({ pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 22 } as PointerEvent);
    component.onPointerEnd();
    component.emitStock(new MouseEvent('click', { cancelable: true }), 1);

    expect(spy).not.toHaveBeenCalled();
  });

  it('emits exactly once for a valid tap or keyboard click', async () => {
    const fixture = await createCard();
    const component = fixture.componentInstance;
    const spy = vi.fn();
    component.favoriteToggle.subscribe(spy);

    component.emitFavorite(new MouseEvent('click'));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('keeps stock controls for contributors and hides tag reprocessing', async () => {
    const fixture = await createCard();
    fixture.componentInstance.isMobileView = false;
    fixture.componentInstance.canReprocess = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label^="Reducir stock"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label^="Incrementar stock"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label^="Reprocesar tags"]')).toBeNull();
  });

  it('uses favorite and a more-actions trigger on mobile', async () => {
    const fixture = await createCard();
    fixture.componentInstance.isMobileView = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label^="Favorito"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label^="Más acciones"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label^="Editar"]')).toBeNull();
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
