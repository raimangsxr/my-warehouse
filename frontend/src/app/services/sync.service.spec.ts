import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { SyncService } from './sync.service';
import { configureServiceTest, flushHttp } from '../../testing/test-helpers';

describe('SyncService', () => {
  let service: SyncService;
  let httpMock: ReturnType<typeof configureServiceTest<SyncService>>['httpMock'];

  beforeEach(() => {
    ({ service, httpMock } = configureServiceTest(SyncService));
  });

  afterEach(() => {
    flushHttp(httpMock);
  });

  it('reports online status from navigator', () => {
    expect(service.isOnline()).toBe(true);
  });

  it('returns zero progress when forcing sync offline', async () => {
    vi.spyOn(service, 'isOnline').mockReturnValue(false);

    const summary = await service.forceSync('wh-1');
    expect(summary.applied).toBe(0);
    expect(summary.queueCountBefore).toBe(0);
    expect(summary.queueCountAfter).toBe(0);
    httpMock.expectNone(`${environment.apiBaseUrl}/sync/push`);
  });

  it('enqueues and counts commands per warehouse', async () => {
    await service.enqueueCommand('wh-1', {
      command_id: 'cmd-1',
      type: 'item.update',
      entity_id: 'item-1',
      base_version: 1,
      payload: { name: 'Hammer' }
    });

    expect(await service.getQueueCount('wh-1')).toBe(1);
    expect(await service.getQueueCount('wh-2')).toBe(0);
  });

  it('pull fetches server changes and stores sequence', async () => {
    const pullPromise = service.pull('wh-1');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const pullReq = httpMock.expectOne((request) => request.url === `${environment.apiBaseUrl}/sync/pull`);
    expect(pullReq.request.params.get('warehouse_id')).toBe('wh-1');
    expect(pullReq.request.params.get('since_seq')).toBe('0');
    pullReq.flush({ changes: [], conflicts: [], last_seq: 7 });

    const response = await pullPromise;
    expect(response.last_seq).toBe(7);
  });
});
