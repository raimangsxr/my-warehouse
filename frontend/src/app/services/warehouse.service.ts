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

  getSelectedWarehouseId(): string | null {
    return localStorage.getItem(this.selectedWarehouseKey);
  }

  setSelectedWarehouseId(warehouseId: string): void {
    localStorage.setItem(this.selectedWarehouseKey, warehouseId);
  }
}
