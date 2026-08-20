import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../core/environment';

export type WarehouseRole = 'administrator' | 'contributor';

export interface Warehouse {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  membership_created_at?: string;
  role: WarehouseRole;
}

export interface WarehouseOverviewMember {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: WarehouseRole;
}

export interface WarehouseOverview extends Warehouse {
  active_item_count?: number;
  stock_unit_count?: number;
  active_box_count?: number;
  open_batch_count?: number;
  member_count?: number;
  members?: WarehouseOverviewMember[];
}

export interface WarehouseMember {
  user_id: string;
  warehouse_id: string;
  email: string;
  display_name: string | null;
  role: WarehouseRole;
  created_at: string;
}

export interface WarehouseInviteResponse {
  warehouse_id: string;
  invite_token: string;
  invite_url: string;
  expires_at: string;
  role: WarehouseRole;
  email_delivery_status: 'sent' | 'not_configured' | 'failed' | 'not_requested';
  email_delivery_message: string;
}

export interface ActivityEvent {
  id: string;
  warehouse_id: string;
  actor_user_id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class WarehouseService {
  private readonly selectedWarehouseKey = 'mw_selected_warehouse_id';
  private readonly knownWarehouses = signal<Warehouse[]>([]);
  readonly selectedWarehouseId = signal<string | null>(localStorage.getItem(this.selectedWarehouseKey));
  readonly selectedWarehouseRole = signal<WarehouseRole | null>(null);
  readonly selectedWarehouseName = computed(() => {
    const selectedId = this.selectedWarehouseId();
    return this.knownWarehouses().find((warehouse) => warehouse.id === selectedId)?.name ?? null;
  });
  readonly isSelectedWarehouseAdministrator = computed(
    () => this.selectedWarehouseRole() === 'administrator'
  );
  readonly canCreateWarehouse = computed(() => {
    const warehouses = this.knownWarehouses();
    return warehouses.length === 0 || warehouses.some((warehouse) => warehouse.role === 'administrator');
  });

  constructor(private readonly http: HttpClient) {}

  list(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(`${environment.apiBaseUrl}/warehouses`).pipe(
      tap((warehouses) => {
        this.knownWarehouses.set(warehouses);
        this.syncSelectedWarehouseRole();
      })
    );
  }

  overview(): Observable<WarehouseOverview[]> {
    return this.http.get<WarehouseOverview[]>(`${environment.apiBaseUrl}/warehouses/overview`).pipe(
      tap((warehouses) => {
        this.knownWarehouses.set(warehouses);
        this.syncSelectedWarehouseRole();
      })
    );
  }

  create(name: string): Observable<Warehouse> {
    return this.http.post<Warehouse>(`${environment.apiBaseUrl}/warehouses`, { name });
  }

  createInvite(
    warehouseId: string,
    payload: { email?: string | null; expires_in_hours?: number; role?: WarehouseRole } = {}
  ): Observable<WarehouseInviteResponse> {
    return this.http.post<WarehouseInviteResponse>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/invites`, payload);
  }

  acceptInvite(token: string): Observable<{ message: string; warehouse_id: string }> {
    return this.http.post<{ message: string; warehouse_id: string }>(
      `${environment.apiBaseUrl}/invites/${encodeURIComponent(token)}/accept`,
      {}
    );
  }

  activity(warehouseId: string, limit = 50): Observable<ActivityEvent[]> {
    return this.http.get<ActivityEvent[]>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/activity`, {
      params: { limit }
    });
  }

  members(warehouseId: string): Observable<WarehouseMember[]> {
    return this.http.get<WarehouseMember[]>(
      `${environment.apiBaseUrl}/warehouses/${warehouseId}/members`
    );
  }

  updateMemberRole(
    warehouseId: string,
    userId: string,
    role: WarehouseRole
  ): Observable<WarehouseMember> {
    return this.http.patch<WarehouseMember>(
      `${environment.apiBaseUrl}/warehouses/${warehouseId}/members/${userId}`,
      { role }
    );
  }

  delete(warehouseId: string, confirmName: string): Observable<{ message: string }> {
    return this.http.request<{ message: string }>('DELETE', `${environment.apiBaseUrl}/warehouses/${warehouseId}`, {
      body: { confirm_name: confirmName },
    });
  }

  getSelectedWarehouseId(): string | null {
    return this.selectedWarehouseId();
  }

  setSelectedWarehouseId(warehouseId: string): void {
    localStorage.setItem(this.selectedWarehouseKey, warehouseId);
    this.selectedWarehouseId.set(warehouseId);
    this.syncSelectedWarehouseRole();
  }

  clearSelectedWarehouseId(): void {
    localStorage.removeItem(this.selectedWarehouseKey);
    this.selectedWarehouseId.set(null);
    this.selectedWarehouseRole.set(null);
  }

  getKnownWarehouses(): Warehouse[] {
    return this.knownWarehouses();
  }

  private syncSelectedWarehouseRole(): void {
    const selectedId = this.getSelectedWarehouseId();
    const selected = this.knownWarehouses().find((warehouse) => warehouse.id === selectedId);
    this.selectedWarehouseRole.set(selected?.role ?? null);
  }
}
