import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../core/environment';

export interface WarehouseExportPayload {
  schema_version: number;
  exported_at: string;
  warehouse: { id: string; name: string };
  boxes: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
  stock_movements: Array<Record<string, unknown>>;
}

export interface WarehouseImportResponse {
  message: string;
  boxes_upserted: number;
  items_upserted: number;
  stock_movements_upserted: number;
}

@Injectable({ providedIn: 'root' })
export class TransferService {
  constructor(private readonly http: HttpClient) {}

  exportWarehouse(warehouseId: string): Observable<WarehouseExportPayload> {
    return this.http.get<WarehouseExportPayload>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/export`);
  }

  importWarehouse(warehouseId: string, payload: WarehouseExportPayload): Observable<WarehouseImportResponse> {
    return this.http.post<WarehouseImportResponse>(
      `${environment.apiBaseUrl}/warehouses/${warehouseId}/import`,
      payload
    );
  }
}
