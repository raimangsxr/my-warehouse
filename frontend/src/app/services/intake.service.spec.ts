import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../core/environment';
import { IntakeService } from './intake.service';
import { configureServiceTest, flushHttp } from '../../testing/test-helpers';

describe('IntakeService', () => {
  let service: IntakeService;
  let httpMock: ReturnType<typeof configureServiceTest<IntakeService>>['httpMock'];

  beforeEach(() => {
    ({ service, httpMock } = configureServiceTest(IntakeService));
  });

  afterEach(() => {
    flushHttp(httpMock);
  });

  it('creates intake batch', () => {
    service.createBatch('wh-1', { target_box_id: 'box-1', name: 'Batch A' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/intake/batches`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ target_box_id: 'box-1', name: 'Batch A' });
    req.flush({ batch: {}, drafts: [] });
  });

  it('uploads batch photos as multipart form', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    service.uploadPhotos('wh-1', 'batch-1', [file]).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/intake/batches/batch-1/photos`);
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ batch: {}, drafts: [], uploaded_count: 1 });
  });

  it('commits batch with review flag', () => {
    service.commitBatch('wh-1', 'batch-1', { include_review: true }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/intake/batches/batch-1/commit`);
    expect(req.request.body).toEqual({ include_review: true });
    req.flush({ batch: {}, created: 1, skipped: 0, errors: 0 });
  });

  it('deletes intake draft', () => {
    service.deleteDraft('wh-1', 'draft-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/intake/drafts/draft-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'deleted' });
  });

  it('lists intake batches with filters', () => {
    service.listBatches('wh-1', { include_committed: true, only_mine: false, limit: 10 }).subscribe();

    const req = httpMock.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/warehouses/wh-1/intake/batches`
    );
    expect(req.request.params.get('include_committed')).toBe('true');
    expect(req.request.params.get('only_mine')).toBe('false');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush([]);
  });

  it('gets intake batch detail', () => {
    service.getBatch('wh-1', 'batch-1').subscribe((detail) => {
      expect(detail.batch.id).toBe('batch-1');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/intake/batches/batch-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ batch: { id: 'batch-1' }, drafts: [] });
  });

  it('starts batch processing', () => {
    service.startBatch('wh-1', 'batch-1', true).subscribe((response) => {
      expect(response.message).toBe('started');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/intake/batches/batch-1/start`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ retry_errors: true });
    req.flush({ message: 'started', batch: { id: 'batch-1' } });
  });

  it('updates intake draft', () => {
    service.updateDraft('wh-1', 'draft-1', { name: 'Hammer', quantity: 2 }).subscribe((draft) => {
      expect(draft.name).toBe('Hammer');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/intake/drafts/draft-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Hammer', quantity: 2 });
    req.flush({ id: 'draft-1', name: 'Hammer' });
  });

  it('reprocesses intake draft', () => {
    service.reprocessDraft('wh-1', 'draft-1', 'photo').subscribe((response) => {
      expect(response.message).toBe('reprocessing');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/intake/drafts/draft-1/reprocess`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ mode: 'photo' });
    req.flush({ message: 'reprocessing', batch: { id: 'batch-1' } });
  });

  it('deletes intake batch', () => {
    service.deleteBatch('wh-1', 'batch-1').subscribe((response) => {
      expect(response.message).toBe('deleted');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/warehouses/wh-1/intake/batches/batch-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'deleted' });
  });
});
