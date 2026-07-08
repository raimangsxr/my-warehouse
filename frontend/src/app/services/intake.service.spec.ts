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
});
