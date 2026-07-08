import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { NotificationService } from '../services/notification.service';
import { ScanComponent } from './scan.component';

describe('ScanComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');

    await TestBed.configureTestingModule({
      imports: [ScanComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        { provide: ActivatedRoute, useValue: createActivatedRouteMock() }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ScanComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('resolves manual identifier and opens box', () => {
    const fixture = TestBed.createComponent(ScanComponent);
    const component = fixture.componentInstance;
    component.manualIdentifier = 'BOX-01';
    component.resolveManualIdentifier();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/boxes/resolve/BOX-01`);
    req.flush({ box_id: 'box-1', warehouse_id: 'wh-1', short_code: 'BOX-01', name: 'Inbound' });

    expect(localStorage.getItem('mw_selected_warehouse_id')).toBe('wh-1');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/boxes/box-1');
  });

  it('maps 404 resolve errors', () => {
    const fixture = TestBed.createComponent(ScanComponent);
    const component = fixture.componentInstance;
    component.manualIdentifier = 'UNKNOWN';
    component.resolveManualIdentifier();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/boxes/resolve/UNKNOWN`);
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });

    expect(component.errorMessage).toContain('no válido');
  });

  it('sets error when BarcodeDetector is missing', async () => {
    const fixture = TestBed.createComponent(ScanComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const original = (window as { BarcodeDetector?: unknown }).BarcodeDetector;
    delete (window as { BarcodeDetector?: unknown }).BarcodeDetector;

    await component.startCameraScan();

    expect(component.errorMessage).toContain('BarcodeDetector');

    if (original) {
      (window as { BarcodeDetector?: unknown }).BarcodeDetector = original;
    }
  });
});
