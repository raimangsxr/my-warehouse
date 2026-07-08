import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { provideCommonTestProviders } from '../../testing/test-helpers';
import { NotificationService } from '../services/notification.service';
import { SyncConflict, SyncService } from '../services/sync.service';
import { ConflictsComponent } from './conflicts.component';

const conflict = (): SyncConflict => ({
  id: 'conflict-1',
  warehouse_id: 'wh-test',
  command_id: 'cmd-1',
  entity_type: 'item',
  entity_id: 'item-1',
  base_version: 1,
  server_version: 2,
  client_payload: { name: 'Hammer' },
  status: 'open',
  created_at: '2026-01-01T00:00:00.000Z',
  resolved_at: null
});

describe('ConflictsComponent', () => {
  let syncService: SyncService;
  let notificationService: NotificationService;

  beforeEach(async () => {
    localStorage.setItem('mw_selected_warehouse_id', 'wh-test');

    await TestBed.configureTestingModule({
      imports: [ConflictsComponent],
      providers: provideCommonTestProviders()
    }).compileComponents();

    syncService = TestBed.inject(SyncService);
    notificationService = TestBed.inject(NotificationService);
    vi.spyOn(notificationService, 'success');
    vi.spyOn(notificationService, 'error');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads conflicts on init', async () => {
    vi.spyOn(syncService, 'pull').mockResolvedValue({ changes: [], conflicts: [conflict()], last_seq: 1 });
    vi.spyOn(syncService, 'listConflicts').mockResolvedValue([conflict()]);

    const fixture = TestBed.createComponent(ConflictsComponent);
    await fixture.componentInstance.reload();

    expect(fixture.componentInstance.conflicts).toHaveLength(1);
  });

  it('resolves conflict keeping server version', async () => {
    vi.spyOn(syncService, 'pull').mockResolvedValue({ changes: [], conflicts: [], last_seq: 2 });
    vi.spyOn(syncService, 'listConflicts')
      .mockResolvedValueOnce([conflict()])
      .mockResolvedValueOnce([]);
    vi.spyOn(syncService, 'resolveConflict').mockResolvedValue(undefined);

    const fixture = TestBed.createComponent(ConflictsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    await component.resolve(conflict(), 'keep_server');

    expect(syncService.resolveConflict).toHaveBeenCalledWith('wh-test', 'conflict-1', 'keep_server');
    expect(notificationService.success).toHaveBeenCalled();
    expect(component.conflicts).toHaveLength(0);
  });
});
