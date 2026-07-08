import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { testBox } from '../../testing/fixtures';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { BoxLabelPrintService } from '../services/box-label-print.service';
import { BoxDetailComponent } from './box-detail.component';

describe('BoxDetailComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    localStorage.removeItem('box_detail_view_mode');
  });

  afterEach(() => {
    httpMock?.verify();
  });

  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [BoxDetailComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        { provide: ActivatedRoute, useValue: createActivatedRouteMock({ id: 'box-1' }) }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(BoxDetailComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/boxes/box-1`).flush(testBox({ id: 'box-1', name: 'Shelf A' }));
    httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/boxes/box-1/items`).flush([]);

    return fixture;
  }

  it('should create', async () => {
    const fixture = await createComponent();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.box?.name).toBe('Shelf A');
  });

  it('persists selected view mode', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    component.setViewMode('list');
    expect(component.viewMode).toBe('list');
    expect(localStorage.getItem('box_detail_view_mode')).toBe('list');
  });

  it('clears search and reloads items', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    component.searchForm.controls.q.setValue('hammer');
    component.clearSearch();

    expect(component.searchForm.controls.q.value).toBe('');

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/boxes/box-1/items`);
    req.flush([]);
    expect(component.items).toEqual([]);
  });

  it('prints box label via print service', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const printService = TestBed.inject(BoxLabelPrintService);
    vi.spyOn(printService, 'printLabel');

    component.printLabel();

    expect(printService.printLabel).toHaveBeenCalledWith(component.box);
  });
});
