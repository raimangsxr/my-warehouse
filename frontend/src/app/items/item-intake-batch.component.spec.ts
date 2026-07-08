import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { testIntakeBatch, testIntakeDraft } from '../../testing/fixtures';
import { createActivatedRouteMock } from '../../testing/component-test-helpers';
import { provideCommonTestProviders } from '../../testing/test-helpers';
import { NotificationService } from '../services/notification.service';
import { ItemIntakeBatchComponent } from './item-intake-batch.component';

describe('ItemIntakeBatchComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.mocked(window.confirm).mockRestore();
    httpMock?.verify();
  });

  async function createComponent(batchId = 'batch-test') {
    await TestBed.configureTestingModule({
      imports: [ItemIntakeBatchComponent],
      providers: [
        provideRouter([]),
        ...provideCommonTestProviders(),
        { provide: ActivatedRoute, useValue: createActivatedRouteMock({ batchId }) }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(ItemIntakeBatchComponent);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.detectChanges();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/intake/batches/${batchId}`);
    req.flush({
      batch: testIntakeBatch({ id: batchId, name: 'Test lot' }),
      drafts: [testIntakeDraft()]
    });

    return fixture;
  }

  it('should create', async () => {
    const fixture = await createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('maps draft backend status to UI status', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    expect(component.uiStatusOf(testIntakeDraft({ status: 'uploaded' }))).toBe('new');
    expect(component.uiStatusOf(testIntakeDraft({ status: 'ready' }))).toBe('processed');
    expect(component.uiStatusOf(testIntakeDraft({ status: 'committed' }))).toBe('saved');
    expect(component.uiStatusOf(testIntakeDraft({ status: 'error' }))).toBe('error');
  });

  it('returns UI status labels', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    expect(component.uiStatusLabel('new')).toBe('Nuevo');
    expect(component.uiStatusLabel('processed')).toBe('Procesado');
    expect(component.uiStatusLabel('error')).toBe('Error');
    expect(component.uiStatusLabel('saved')).toBe('Guardado');
  });

  it('builds draft title from name or status fallback', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    expect(component.draftTitle(testIntakeDraft({ name: 'Drill' }))).toBe('Drill');
    expect(component.draftTitle(testIntakeDraft({ name: null, status: 'ready' }))).toBe('Artículo procesado');
  });

  it('formats confidence as rounded percent', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    expect(component.confidencePercent(0.856)).toBe(86);
    expect(component.confidencePercent(0.4)).toBe(40);
  });

  it('deletes batch after confirmation', async () => {
    const fixture = await createComponent('batch-del');
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');

    component.deleteBatch();

    expect(window.confirm).toHaveBeenCalled();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-test/intake/batches/batch-del`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'deleted' });

    expect(notificationService.success).toHaveBeenCalledWith('Lote eliminado.');
    expect(router.navigate).toHaveBeenCalledWith(['/app/batches']);
  });
});
