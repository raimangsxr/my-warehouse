import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../core/environment';

export type IntakeDraftStatus =
  | 'uploaded'
  | 'processing'
  | 'ready'
  | 'review'
  | 'rejected'
  | 'error'
  | 'committed';

export type IntakeBatchStatus = 'drafting' | 'processing' | 'review' | 'committed';

export interface IntakeBatch {
  id: string;
  warehouse_id: string;
  target_box_id: string;
  created_by: string;
  name: string | null;
  status: IntakeBatchStatus;
  total_count: number;
  processed_count: number;
  committed_count: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  status_counts: Record<string, number>;
}

export interface IntakeDraft {
  id: string;
  warehouse_id: string;
  batch_id: string;
  photo_url: string;
  status: IntakeDraftStatus;
  position: number;
  name: string | null;
  description: string | null;
  tags: string[];
  aliases: string[];
  confidence: number;
  warnings: string[];
  llm_used: boolean;
  error_message: string | null;
  processing_attempts: number;
  created_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntakeBatchDetail {
  batch: IntakeBatch;
  drafts: IntakeDraft[];
}

export interface IntakeBatchUploadResponse {
  batch: IntakeBatch;
  drafts: IntakeDraft[];
  uploaded_count: number;
}

export interface IntakeBatchStartResponse {
  message: string;
  batch: IntakeBatch;
}

export interface IntakeBatchCommitResponse {
  batch: IntakeBatch;
  created: number;
  skipped: number;
  errors: number;
}

@Injectable({ providedIn: 'root' })
export class IntakeService {
  constructor(private readonly http: HttpClient) {}

  createBatch(warehouseId: string, payload: { target_box_id: string; name?: string | null }): Observable<IntakeBatchDetail> {
    return this.http.post<IntakeBatchDetail>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/intake/batches`, payload);
  }

  listBatches(
    warehouseId: string,
    params: { include_committed?: boolean; only_mine?: boolean; limit?: number } = {}
  ): Observable<IntakeBatch[]> {
    return this.http.get<IntakeBatch[]>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/intake/batches`, {
      params: {
        include_committed: params.include_committed ?? false,
        only_mine: params.only_mine ?? true,
        limit: params.limit ?? 20
      }
    });
  }

  getBatch(warehouseId: string, batchId: string): Observable<IntakeBatchDetail> {
    return this.http.get<IntakeBatchDetail>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/intake/batches/${batchId}`);
  }

  uploadPhotos(warehouseId: string, batchId: string, files: File[]): Observable<IntakeBatchUploadResponse> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    return this.http.post<IntakeBatchUploadResponse>(
      `${environment.apiBaseUrl}/warehouses/${warehouseId}/intake/batches/${batchId}/photos`,
      formData
    );
  }

  startBatch(warehouseId: string, batchId: string, retryErrors = false): Observable<IntakeBatchStartResponse> {
    return this.http.post<IntakeBatchStartResponse>(
      `${environment.apiBaseUrl}/warehouses/${warehouseId}/intake/batches/${batchId}/start`,
      { retry_errors: retryErrors }
    );
  }

  updateDraft(
    warehouseId: string,
    draftId: string,
    payload: {
      name?: string | null;
      description?: string | null;
      tags?: string[];
      aliases?: string[];
      status?: IntakeDraftStatus;
    }
  ): Observable<IntakeDraft> {
    return this.http.patch<IntakeDraft>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/intake/drafts/${draftId}`, payload);
  }

  commitBatch(
    warehouseId: string,
    batchId: string,
    payload: { include_review?: boolean } = {}
  ): Observable<IntakeBatchCommitResponse> {
    return this.http.post<IntakeBatchCommitResponse>(
      `${environment.apiBaseUrl}/warehouses/${warehouseId}/intake/batches/${batchId}/commit`,
      payload
    );
  }

  deleteBatch(warehouseId: string, batchId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${environment.apiBaseUrl}/warehouses/${warehouseId}/intake/batches/${batchId}`);
  }
}
