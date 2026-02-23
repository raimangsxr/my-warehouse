import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

import { environment } from '../core/environment';

export interface SyncCommand {
  command_id: string;
  type: string;
  entity_id?: string | null;
  base_version?: number | null;
  payload: Record<string, unknown>;
}

interface QueuedCommandRecord extends SyncCommand {
  warehouse_id: string;
  created_at: string;
}

interface MetaRecord {
  key: string;
  value: string;
}

export interface SyncConflict {
  id: string;
  warehouse_id: string;
  command_id: string;
  entity_type: string;
  entity_id: string;
  base_version: number | null;
  server_version: number | null;
  client_payload: Record<string, unknown>;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

interface SyncPushResponse {
  applied_command_ids: string[];
  skipped_command_ids: string[];
  conflicts: SyncConflict[];
  last_seq: number;
}

interface SyncPullResponse {
  changes: Array<Record<string, unknown>>;
  conflicts: SyncConflict[];
  last_seq: number;
}

export interface SyncSummary {
  queueCountBefore: number;
  queueCountAfter: number;
  applied: number;
  skipped: number;
  conflicts: number;
  lastSeq: number;
}

const DB_NAME = 'my-warehouse-offline';
const DB_VERSION = 1;
const COMMANDS_STORE = 'commands';
const META_STORE = 'meta';
const CONFLICTS_STORE = 'conflicts';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly dbPromise: Promise<IDBDatabase>;
  private readonly onlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  private readonly deviceId = this.ensureDeviceId();

  constructor(private readonly http: HttpClient) {
    this.dbPromise = this.openDb();
    window.addEventListener('online', () => this.onlineSubject.next(true));
    window.addEventListener('offline', () => this.onlineSubject.next(false));
  }

  get online$() {
    return this.onlineSubject.asObservable();
  }

  isOnline(): boolean {
    return this.onlineSubject.value;
  }

  async enqueueCommand(warehouseId: string, command: SyncCommand): Promise<void> {
    const db = await this.dbPromise;
    await this.idbPut<QueuedCommandRecord>(db, COMMANDS_STORE, {
      ...command,
      warehouse_id: warehouseId,
      created_at: new Date().toISOString(),
    });
  }

  async getQueueCount(warehouseId: string): Promise<number> {
    const commands = await this.listQueuedCommands(warehouseId);
    return commands.length;
  }

  async listConflicts(warehouseId: string): Promise<SyncConflict[]> {
    const db = await this.dbPromise;
    return this.idbGetAllByIndex<SyncConflict>(db, CONFLICTS_STORE, 'warehouse_id', warehouseId);
  }

  async pull(warehouseId: string): Promise<SyncPullResponse> {
    const sinceSeq = await this.getSinceSeq(warehouseId);
    const response = await firstValueFrom(
      this.http.get<SyncPullResponse>(`${environment.apiBaseUrl}/sync/pull`, {
        params: {
          warehouse_id: warehouseId,
          since_seq: String(sinceSeq),
        },
      })
    );

    await this.setSinceSeq(warehouseId, response.last_seq);
    await this.replaceConflicts(warehouseId, response.conflicts);
    return response;
  }

  async forceSync(warehouseId: string): Promise<SyncSummary> {
    const queueBefore = await this.getQueueCount(warehouseId);

    if (!this.isOnline()) {
      return {
        queueCountBefore: queueBefore,
        queueCountAfter: queueBefore,
        applied: 0,
        skipped: 0,
        conflicts: 0,
        lastSeq: await this.getSinceSeq(warehouseId),
      };
    }

    const commands = await this.listQueuedCommands(warehouseId);

    let applied = 0;
    let skipped = 0;
    let conflicts = 0;

    if (commands.length > 0) {
      const pushResponse = await firstValueFrom(
        this.http.post<SyncPushResponse>(`${environment.apiBaseUrl}/sync/push`, {
          warehouse_id: warehouseId,
          device_id: this.deviceId,
          commands: commands.map((command) => ({
            command_id: command.command_id,
            type: command.type,
            entity_id: command.entity_id,
            base_version: command.base_version,
            payload: command.payload,
          })),
        })
      );

      applied = pushResponse.applied_command_ids.length;
      skipped = pushResponse.skipped_command_ids.length;
      conflicts = pushResponse.conflicts.length;

      const removeIds = new Set<string>([
        ...pushResponse.applied_command_ids,
        ...pushResponse.skipped_command_ids,
        ...pushResponse.conflicts.map((c) => c.command_id),
      ]);
      await this.removeQueuedCommands([...removeIds]);
      await this.replaceConflicts(warehouseId, pushResponse.conflicts);
    }

    const pullResponse = await this.pull(warehouseId);
    const queueAfter = await this.getQueueCount(warehouseId);

    return {
      queueCountBefore: queueBefore,
      queueCountAfter: queueAfter,
      applied,
      skipped,
      conflicts: pullResponse.conflicts.length,
      lastSeq: pullResponse.last_seq,
    };
  }

  async resolveConflict(
    warehouseId: string,
    conflictId: string,
    resolution: 'keep_server' | 'keep_client' | 'merge',
    payload: Record<string, unknown> = {}
  ): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/sync/resolve`, {
        warehouse_id: warehouseId,
        conflict_id: conflictId,
        resolution,
        payload,
      })
    );

    await this.pull(warehouseId);
  }

  private async listQueuedCommands(warehouseId: string): Promise<QueuedCommandRecord[]> {
    const db = await this.dbPromise;
    const commands = await this.idbGetAllByIndex<QueuedCommandRecord>(db, COMMANDS_STORE, 'warehouse_id', warehouseId);
    return commands.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  private async removeQueuedCommands(commandIds: string[]): Promise<void> {
    if (commandIds.length === 0) {
      return;
    }
    const db = await this.dbPromise;
    await this.idbDeleteMany(db, COMMANDS_STORE, commandIds);
  }

  private async getSinceSeq(warehouseId: string): Promise<number> {
    const db = await this.dbPromise;
    const record = await this.idbGet<MetaRecord>(db, META_STORE, `since_seq:${warehouseId}`);
    if (!record) {
      return 0;
    }
    const value = Number(record.value);
    return Number.isFinite(value) ? value : 0;
  }

  private async setSinceSeq(warehouseId: string, seq: number): Promise<void> {
    const db = await this.dbPromise;
    await this.idbPut<MetaRecord>(db, META_STORE, {
      key: `since_seq:${warehouseId}`,
      value: String(seq),
    });
  }

  private async replaceConflicts(warehouseId: string, conflicts: SyncConflict[]): Promise<void> {
    const db = await this.dbPromise;
    await this.idbDeleteByIndex(db, CONFLICTS_STORE, 'warehouse_id', warehouseId);
    for (const conflict of conflicts) {
      await this.idbPut<SyncConflict>(db, CONFLICTS_STORE, conflict);
    }
  }

  private ensureDeviceId(): string {
    const key = 'mw_device_id';
    const existing = localStorage.getItem(key);
    if (existing) {
      return existing;
    }
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(COMMANDS_STORE)) {
          const store = db.createObjectStore(COMMANDS_STORE, { keyPath: 'command_id' });
          store.createIndex('warehouse_id', 'warehouse_id', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }

        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(CONFLICTS_STORE)) {
          const store = db.createObjectStore(CONFLICTS_STORE, { keyPath: 'id' });
          store.createIndex('warehouse_id', 'warehouse_id', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private idbPut<T>(db: IDBDatabase, storeName: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private idbGet<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  private idbGetAllByIndex<T>(
    db: IDBDatabase,
    storeName: string,
    indexName: string,
    key: string
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const index = tx.objectStore(storeName).index(indexName);
      const req = index.getAll(IDBKeyRange.only(key));
      req.onsuccess = () => resolve((req.result ?? []) as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  private idbDeleteMany(db: IDBDatabase, storeName: string, keys: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const key of keys) {
        store.delete(key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private idbDeleteByIndex(db: IDBDatabase, storeName: string, indexName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.openCursor(IDBKeyRange.only(key));

      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          return;
        }
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
