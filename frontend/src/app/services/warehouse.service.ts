import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../core/environment';

export interface Warehouse {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface WarehouseInviteResponse {
  warehouse_id: string;
  invite_token: string;
  invite_url: string;
  expires_at: string;
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

  constructor(private readonly http: HttpClient) {}

  list(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(`${environment.apiBaseUrl}/warehouses`);
  }

  create(name: string): Observable<Warehouse> {
    return this.http.post<Warehouse>(`${environment.apiBaseUrl}/warehouses`, { name });
  }

  createInvite(
    warehouseId: string,
    payload: { email?: string | null; expires_in_hours?: number } = {}
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

  getSelectedWarehouseId(): string | null {
    return localStorage.getItem(this.selectedWarehouseKey);
  }

  setSelectedWarehouseId(warehouseId: string): void {
    localStorage.setItem(this.selectedWarehouseKey, warehouseId);
  }
}
