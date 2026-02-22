import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../core/environment';

export interface Item {
  id: string;
  warehouse_id: string;
  box_id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  physical_location: string | null;
  tags: string[];
  aliases: string[];
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  stock: number;
  is_favorite: boolean;
  box_path: string[];
}

export type BatchAction = 'move' | 'favorite' | 'unfavorite' | 'delete';

@Injectable({ providedIn: 'root' })
export class ItemService {
  constructor(private readonly http: HttpClient) {}

  list(
    warehouseId: string,
    options: {
      q?: string;
      favoritesOnly?: boolean;
      stockZero?: boolean;
      withPhoto?: boolean | null;
      includeDeleted?: boolean;
    } = {}
  ): Observable<Item[]> {
    let params = new HttpParams();
    if (options.q) {
      params = params.set('q', options.q);
    }
    if (options.favoritesOnly) {
      params = params.set('favorites_only', true);
    }
    if (options.stockZero) {
      params = params.set('stock_zero', true);
    }
    if (options.withPhoto !== undefined && options.withPhoto !== null) {
      params = params.set('with_photo', options.withPhoto);
    }
    if (options.includeDeleted) {
      params = params.set('include_deleted', true);
    }

    return this.http.get<Item[]>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/items`, { params });
  }

  get(warehouseId: string, itemId: string): Observable<Item> {
    return this.http.get<Item>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/items/${itemId}`);
  }

  create(
    warehouseId: string,
    payload: {
      box_id: string;
      name: string;
      description?: string | null;
      photo_url?: string | null;
      physical_location?: string | null;
      tags?: string[];
      aliases?: string[];
    }
  ): Observable<Item> {
    return this.http.post<Item>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/items`, payload);
  }

  update(
    warehouseId: string,
    itemId: string,
    payload: {
      box_id?: string;
      name?: string;
      description?: string | null;
      photo_url?: string | null;
      physical_location?: string | null;
      tags?: string[];
      aliases?: string[];
    }
  ): Observable<Item> {
    return this.http.patch<Item>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/items/${itemId}`, payload);
  }

  delete(warehouseId: string, itemId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/items/${itemId}`);
  }

  restore(warehouseId: string, itemId: string): Observable<Item> {
    return this.http.post<Item>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/items/${itemId}/restore`, {});
  }

  setFavorite(warehouseId: string, itemId: string, isFavorite: boolean): Observable<Item> {
    return this.http.post<Item>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/items/${itemId}/favorite`, {
      is_favorite: isFavorite
    });
  }

  adjustStock(
    warehouseId: string,
    itemId: string,
    delta: 1 | -1,
    commandId: string,
    note?: string
  ): Observable<Item> {
    return this.http.post<Item>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/items/${itemId}/stock/adjust`, {
      delta,
      command_id: commandId,
      note
    });
  }

  batch(
    warehouseId: string,
    payload: { item_ids: string[]; action: BatchAction; target_box_id?: string }
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/items/batch`, payload);
  }
}
