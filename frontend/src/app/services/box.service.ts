import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../core/environment';

export interface Box {
  id: string;
  warehouse_id: string;
  parent_box_id: string | null;
  name: string;
  description: string | null;
  physical_location: string | null;
  short_code: string;
  qr_token: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BoxTreeNode {
  box: Box;
  level: number;
  total_items_recursive: number;
  total_boxes_recursive: number;
}

export interface BoxItem {
  id: string;
  box_id: string;
  name: string;
  description: string | null;
  physical_location: string | null;
  stock: number;
  box_path: string[];
}

@Injectable({ providedIn: 'root' })
export class BoxService {
  constructor(private readonly http: HttpClient) {}

  tree(warehouseId: string, includeDeleted = false): Observable<BoxTreeNode[]> {
    const params = new HttpParams().set('include_deleted', includeDeleted);
    return this.http.get<BoxTreeNode[]>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/boxes/tree`, {
      params
    });
  }

  create(
    warehouseId: string,
    payload: {
      parent_box_id?: string | null;
      name?: string | null;
      description?: string | null;
      physical_location?: string | null;
    }
  ): Observable<Box> {
    return this.http.post<Box>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/boxes`, payload);
  }

  get(warehouseId: string, boxId: string): Observable<Box> {
    return this.http.get<Box>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/boxes/${boxId}`);
  }

  update(
    warehouseId: string,
    boxId: string,
    payload: { name?: string; description?: string | null; physical_location?: string | null }
  ): Observable<Box> {
    return this.http.patch<Box>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/boxes/${boxId}`, payload);
  }

  move(warehouseId: string, boxId: string, newParentBoxId: string | null): Observable<Box> {
    return this.http.post<Box>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/boxes/${boxId}/move`, {
      new_parent_box_id: newParentBoxId
    });
  }

  delete(warehouseId: string, boxId: string, force = false): Observable<{ message: string }> {
    return this.http.request<{ message: string }>('DELETE', `${environment.apiBaseUrl}/warehouses/${warehouseId}/boxes/${boxId}`, {
      body: { force }
    });
  }

  restore(warehouseId: string, boxId: string): Observable<Box> {
    return this.http.post<Box>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/boxes/${boxId}/restore`, {});
  }

  listRecursiveItems(warehouseId: string, boxId: string, q = ''): Observable<BoxItem[]> {
    const params = q ? new HttpParams().set('q', q) : undefined;
    return this.http.get<BoxItem[]>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/boxes/${boxId}/items`, {
      params
    });
  }
}
