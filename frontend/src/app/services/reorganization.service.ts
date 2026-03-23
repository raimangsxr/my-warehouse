import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, interval } from 'rxjs';
import { catchError, filter, finalize, switchMap, takeWhile, tap } from 'rxjs/operators';

import { environment } from '../core/environment';
import { BackgroundJobsService } from './background-jobs.service';
import { NotificationService } from './notification.service';

export interface ReorganizationSuggestionItem {
  suggestion_id: string;
  item_id: string;
  item_name: string;
  from_box_id: string;
  from_box_name: string;
  to_box_id: string;
  to_box_name: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'dismissed';
}

export interface ReorganizationSession {
  id: string;
  warehouse_id: string;
  created_by: string;
  status: 'running' | 'ready' | 'error' | 'completed' | 'archived';
  suggestions: ReorganizationSuggestionItem[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class ReorganizationService {
  private readonly http = inject(HttpClient);
  private readonly backgroundJobs = inject(BackgroundJobsService);
  private readonly notifications = inject(NotificationService);

  startAnalysis(warehouseId: string, force = false): Observable<ReorganizationSession> {
    return this.http.post<ReorganizationSession>(
      `${environment.apiBaseUrl}/warehouses/${warehouseId}/reorganization/sessions`,
      {},
      { params: { force } }
    ).pipe(
      tap(session => {
        this.backgroundJobs.registerJob({
          id: session.id,
          type: 'reorganization',
          label: 'Analizando reorganización…',
          status: 'running',
          warehouseId,
        });
      })
    );
  }

  getCurrentSession(warehouseId: string): Observable<ReorganizationSession | null> {
    return this.http.get<ReorganizationSession>(
      `${environment.apiBaseUrl}/warehouses/${warehouseId}/reorganization/sessions/current`
    ).pipe(
      catchError(() => [null])
    );
  }

  confirmSuggestion(warehouseId: string, sessionId: string, suggestionId: string): Observable<ReorganizationSession> {
    return this.http.post<ReorganizationSession>(
      `${environment.apiBaseUrl}/warehouses/${warehouseId}/reorganization/sessions/${sessionId}/suggestions/${suggestionId}/confirm`,
      {}
    );
  }

  dismissSuggestion(warehouseId: string, sessionId: string, suggestionId: string): Observable<ReorganizationSession> {
    return this.http.post<ReorganizationSession>(
      `${environment.apiBaseUrl}/warehouses/${warehouseId}/reorganization/sessions/${sessionId}/suggestions/${suggestionId}/dismiss`,
      {}
    );
  }

  pollSession$(warehouseId: string, sessionId: string): Observable<ReorganizationSession> {
    return interval(3000).pipe(
      switchMap(() => this.getCurrentSession(warehouseId)),
      filter((s): s is ReorganizationSession => s !== null),
      takeWhile(s => s.status === 'running', true),
      tap(session => {
        if (session.status !== 'running') {
          if (session.status === 'error') {
            this.backgroundJobs.updateJobStatus(sessionId, 'error');
            this.notifications.error(
              session.error_message
                ? `Reorganización fallida: ${session.error_message}`
                : 'El análisis de reorganización ha fallado.'
            );
          } else {
            this.backgroundJobs.updateJobStatus(sessionId, 'completed');
            this.notifications.success('Análisis de reorganización completado.');
          }
        }
      }),
      finalize(() => {
        this.backgroundJobs.unregisterJob(sessionId);
      })
    );
  }
}
