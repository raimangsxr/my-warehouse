import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../core/environment';
import { SyncService } from './sync.service';
import { configureServiceTest, flushHttp } from '../../testing/test-helpers';

describe('SyncService', () => {
  let service: SyncService;
  let httpMock: ReturnType<typeof configureServiceTest<SyncService>>['httpMock'];

  beforeEach(async () => {
    ({ service, httpMock } = configureServiceTest(SyncService));
    await service.purgeWarehouse('wh-1');
    await service.purgeWarehouse('wh-force-sync');
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

  it('pulls sync changes for warehouse', async () => {
    await service.getQueueCount('wh-1');
    const pullPromise = service.pull('wh-1');
    await new Promise((r) => setTimeout(r, 0));

    const req = httpMock.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/sync/pull`
    );
    expect(req.request.params.get('warehouse_id')).toBe('wh-1');
    expect(req.request.params.get('since_seq')).toBe('0');
    req.flush({ changes: [], conflicts: [], last_seq: 42 });

    const response = await pullPromise;
    expect(response.last_seq).toBe(42);
  });

  it('purgeWarehouse clears queued commands', async () => {
    await service.purgeWarehouse('wh-1');
    await service.enqueueCommand('wh-1', {
      command_id: 'cmd-purge',
      type: 'item.update',
      entity_id: 'item-1',
      base_version: 1,
      payload: { name: 'Hammer' }
    });
    expect(await service.getQueueCount('wh-1')).toBe(1);

    await service.purgeWarehouse('wh-1');
    expect(await service.getQueueCount('wh-1')).toBe(0);
  });

  it('resolveConflict posts resolution then pulls', async () => {
    const resolvePromise = service.resolveConflict('wh-1', 'conflict-1', 'keep_server');
    await new Promise((r) => setTimeout(r, 0));

    const resolveReq = httpMock.expectOne(`${environment.apiBaseUrl}/sync/resolve`);
    expect(resolveReq.request.method).toBe('POST');
    expect(resolveReq.request.body).toEqual({
      warehouse_id: 'wh-1',
      conflict_id: 'conflict-1',
      resolution: 'keep_server',
      payload: {}
    });
    resolveReq.flush({});

    await new Promise((r) => setTimeout(r, 0));

    const pullReq = httpMock.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/sync/pull`
    );
    expect(pullReq.request.params.get('warehouse_id')).toBe('wh-1');
    pullReq.flush({ changes: [], conflicts: [], last_seq: 10 });

    await resolvePromise;
  });

  it('forceSync online pushes queued commands then pulls', async () => {
    const warehouseId = 'wh-force-sync';
    await service.enqueueCommand(warehouseId, {
      command_id: 'cmd-sync',
      type: 'item.update',
      entity_id: 'item-1',
      base_version: 1,
      payload: { name: 'Updated' }
    });

    const syncPromise = service.forceSync(warehouseId);

    await vi.waitFor(() => {
      const pushReq = httpMock.expectOne(`${environment.apiBaseUrl}/sync/push`);
      expect(pushReq.request.body).toMatchObject({
        warehouse_id: warehouseId,
        commands: [
          expect.objectContaining({
            command_id: 'cmd-sync',
            type: 'item.update',
            entity_id: 'item-1'
          })
        ]
      });
      pushReq.flush({
        applied_command_ids: ['cmd-sync'],
        skipped_command_ids: [],
        conflicts: []
      });
    });

    await vi.waitFor(() => {
      const pullReq = httpMock.expectOne(
        (request) => request.url === `${environment.apiBaseUrl}/sync/pull`
      );
      expect(pullReq.request.params.get('warehouse_id')).toBe(warehouseId);
      pullReq.flush({ changes: [], conflicts: [], last_seq: 99 });
    });

    const summary = await syncPromise;
    expect(summary.applied).toBe(1);
    expect(summary.queueCountBefore).toBe(1);
    expect(summary.queueCountAfter).toBe(0);
    expect(summary.lastSeq).toBe(99);
  });
});
