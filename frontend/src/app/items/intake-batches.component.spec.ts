import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { testIntakeBatch } from '../../testing/fixtures';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { BoxTreeNode } from '../services/box.service';
import { NotificationService } from '../services/notification.service';
import { IntakeBatchesComponent } from './intake-batches.component';
import { ActivatedRoute, provideRouter } from '@angular/router';

const testBoxTree: BoxTreeNode[] = [
  {
    box: {
      id: 'box-test',
      warehouse_id: 'wh-test',
      parent_box_id: null,
      name: 'Root',
      description: null,
      physical_location: null,
      short_code: 'R1',
      qr_token: 'qr',
      is_inbound: false,
      version: 1,
      created_at: '',
      updated_at: '',
      deleted_at: null
    },
    level: 0,
    total_items_recursive: 0,
    total_boxes_recursive: 0
  }
];

describe('IntakeBatchesComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
  });

  afterEach(() => {
    httpMock?.verify();
  });

  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [IntakeBatchesComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        { provide: ActivatedRoute, useValue: createActivatedRouteMock() }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(IntakeBatchesComponent);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.detectChanges();

    httpMock.expectOne((request) => request.url.includes('/boxes/tree')).flush(testBoxTree);
    httpMock.expectOne((request) => request.url.includes('/intake/batches')).flush([]);

    return fixture;
  }

  it('should create', async () => {
    const fixture = await createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('maps batch status labels', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    expect(component.statusLabel('drafting')).toBe('Activo');
    expect(component.statusLabel('processing')).toBe('Procesando');
    expect(component.statusLabel('review')).toBe('Revisión');
    expect(component.statusLabel('committed')).toBe('Completado');
  });

  it('aggregates UI status counts from backend status_counts', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const batch = testIntakeBatch({
      status_counts: {
        uploaded: 2,
        processing: 1,
        ready: 3,
        review: 1,
        error: 1,
        rejected: 2,
        committed: 4
      }
    });

    expect(component.countByUiStatus(batch, 'new')).toBe(3);
    expect(component.countByUiStatus(batch, 'processed')).toBe(4);
    expect(component.countByUiStatus(batch, 'error')).toBe(3);
    expect(component.countByUiStatus(batch, 'saved')).toBe(4);
  });

  it('builds batch title from name or id prefix', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    expect(component.batchTitle(testIntakeBatch({ name: 'Morning intake' }))).toBe('Morning intake');
    expect(component.batchTitle(testIntakeBatch({ id: 'abcdef12-3456', name: null }))).toBe('Lote abcdef12');
  });

  it('creates a batch via HTTP and navigates to detail', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');

    component.targetBoxId = 'box-test';
    component.batchName = 'New lot';
    component.createBatch();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/intake/batches`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ target_box_id: 'box-test', name: 'New lot' });
    req.flush({ batch: testIntakeBatch({ id: 'batch-new' }), drafts: [] });

    expect(notificationService.success).toHaveBeenCalledWith('Lote creado.');
    expect(component.batchName).toBe('');
    expect(router.navigate).toHaveBeenCalledWith(['/app/batches', 'batch-new']);
  });

  it('reloads batches from API', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const batches = [testIntakeBatch({ id: 'batch-1' }), testIntakeBatch({ id: 'batch-2', name: 'Second' })];

    component.loadBatches();

    const req = httpMock.expectOne((request) => request.url.includes('/intake/batches'));
    req.flush(batches);

    expect(component.batches).toEqual(batches);
    expect(component.loading).toBe(false);
  });
});
