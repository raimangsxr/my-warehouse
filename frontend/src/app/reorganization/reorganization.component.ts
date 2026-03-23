import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  ReorganizationService,
  ReorganizationSession,
  ReorganizationSuggestionItem,
} from '../services/reorganization.service';
import { NotificationService } from '../services/notification.service';
import { WarehouseService } from '../services/warehouse.service';
import { ConfirmNewAnalysisDialogComponent } from './confirm-new-analysis-dialog.component';

/** A group of suggestions sharing the same from_box_id */
export interface SuggestionGroup {
  from_box_id: string;
  from_box_name: string;
  suggestions: ReorganizationSuggestionItem[];
}

/** Property 11: group by from_box_id — each from_box_id appears in exactly one group */
export function groupSuggestions(suggestions: ReorganizationSuggestionItem[]): SuggestionGroup[] {
  const map = new Map<string, SuggestionGroup>();
  for (const s of suggestions) {
    if (!map.has(s.from_box_id)) {
      map.set(s.from_box_id, {
        from_box_id: s.from_box_id,
        from_box_name: s.from_box_name,
        suggestions: [],
      });
    }
    map.get(s.from_box_id)!.suggestions.push(s);
  }
  return sortGroups(Array.from(map.values()));
}

/**
 * Property 12: sort groups prioritizing those whose most-frequent to_box_id
 * is shared with other groups (minimises physical trips).
 */
export function sortGroups(groups: SuggestionGroup[]): SuggestionGroup[] {
  // For each group, find the most-frequent to_box_id
  const dominantToBox = (g: SuggestionGroup): string => {
    const freq = new Map<string, number>();
    for (const s of g.suggestions) {
      freq.set(s.to_box_id, (freq.get(s.to_box_id) ?? 0) + 1);
    }
    let best = '';
    let bestCount = 0;
    for (const [id, count] of freq) {
      if (count > bestCount) { bestCount = count; best = id; }
    }
    return best;
  };

  // Count how many groups share each dominant to_box_id
  const dominants = groups.map(dominantToBox);
  const sharedCount = new Map<string, number>();
  for (const d of dominants) {
    sharedCount.set(d, (sharedCount.get(d) ?? 0) + 1);
  }

  // Groups whose dominant to_box_id is shared with ≥2 groups come first
  return [...groups].sort((a, b) => {
    const da = dominantToBox(a);
    const db = dominantToBox(b);
    const sa = sharedCount.get(da) ?? 1;
    const sb = sharedCount.get(db) ?? 1;
    return sb - sa; // descending: more shared = earlier
  });
}

type ViewState = 'empty' | 'loading' | 'ready' | 'completed';

@Component({
  selector: 'app-reorganization',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './reorganization.component.html',
  styleUrls: ['./reorganization.component.scss'],
})
export class ReorganizationComponent implements OnInit {
  private readonly reorganizationService = inject(ReorganizationService);
  private readonly notificationService = inject(NotificationService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly warehouseId = this.warehouseService.getSelectedWarehouseId();

  /** Local session state (source of truth for optimistic updates) */
  readonly session = signal<ReorganizationSession | null>(null);
  readonly isStarting = signal(false);

  readonly viewState = computed<ViewState>(() => {
    const s = this.session();
    if (!s) return 'empty';
    if (s.status === 'running') return 'loading';
    if (s.status === 'ready') return 'ready';
    return 'completed'; // completed | archived | error
  });

  readonly groups = computed<SuggestionGroup[]>(() => {
    const s = this.session();
    if (!s) return [];
    return groupSuggestions(s.suggestions);
  });

  ngOnInit(): void {
    if (!this.warehouseId) {
      this.router.navigateByUrl('/warehouses');
      return;
    }
    this.loadCurrentSession();
  }

  private loadCurrentSession(): void {
    this.reorganizationService.getCurrentSession(this.warehouseId!).subscribe({
      next: (s) => {
        this.session.set(s);
        if (s?.status === 'running') {
          this.startPolling(s.id);
        }
      },
      error: () => {
        // 404 → no session → empty state (service already returns null on error)
        this.session.set(null);
      },
    });
  }

  private startPolling(sessionId: string): void {
    this.reorganizationService
      .pollSession$(this.warehouseId!, sessionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s: ReorganizationSession) => this.session.set(s),
        error: () => {
          // polling error — keep last known state
        },
      });
  }

  startAnalysis(force = false): void {
    if (!this.warehouseId || this.isStarting()) return;
    this.isStarting.set(true);
    this.reorganizationService.startAnalysis(this.warehouseId, force).subscribe({
      next: (s) => {
        this.session.set(s);
        this.isStarting.set(false);
        this.startPolling(s.id);
      },
      error: () => {
        this.isStarting.set(false);
        this.notificationService.error('No se pudo iniciar el análisis de reorganización.');
      },
    });
  }

  openNewAnalysisDialog(): void {
    const ref = this.dialog.open(ConfirmNewAnalysisDialogComponent, { width: '360px' });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) this.startAnalysis(true);
    });
  }

  /**
   * Property 13: optimistic update — change local state immediately,
   * revert on HTTP error.
   */
  confirmSuggestion(_group: SuggestionGroup, suggestion: ReorganizationSuggestionItem): void {
    if (!this.warehouseId) return;
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    const previous = this.session()!;
    this.applyOptimisticUpdate(suggestion.suggestion_id, 'confirmed');

    this.reorganizationService
      .confirmSuggestion(this.warehouseId, sessionId, suggestion.suggestion_id)
      .subscribe({
        next: (updated) => this.session.set(updated),
        error: () => {
          this.session.set(previous);
          this.notificationService.error('No se pudo confirmar el movimiento. Inténtalo de nuevo.');
        },
      });
  }

  dismissSuggestion(_group: SuggestionGroup, suggestion: ReorganizationSuggestionItem): void {
    if (!this.warehouseId) return;
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    const previous = this.session()!;
    this.applyOptimisticUpdate(suggestion.suggestion_id, 'dismissed');

    this.reorganizationService
      .dismissSuggestion(this.warehouseId, sessionId, suggestion.suggestion_id)
      .subscribe({
        next: (updated) => this.session.set(updated),
        error: () => {
          this.session.set(previous);
          this.notificationService.error('No se pudo descartar la sugerencia. Inténtalo de nuevo.');
        },
      });
  }

  private applyOptimisticUpdate(
    suggestionId: string,
    newStatus: 'confirmed' | 'dismissed'
  ): void {
    const current = this.session();
    if (!current) return;
    const updatedSuggestions = current.suggestions.map((s) =>
      s.suggestion_id === suggestionId ? { ...s, status: newStatus } : s
    );
    const allResolved = updatedSuggestions.every(
      (s) => s.status === 'confirmed' || s.status === 'dismissed'
    );
    this.session.set({
      ...current,
      suggestions: updatedSuggestions,
      status: allResolved ? 'completed' : current.status,
    });
  }

  pendingCount(group: SuggestionGroup): number {
    return group.suggestions.filter((s) => s.status === 'pending').length;
  }

  trackByGroupId(_i: number, g: SuggestionGroup): string {
    return g.from_box_id;
  }

  trackBySuggestionId(_i: number, s: ReorganizationSuggestionItem): string {
    return s.suggestion_id;
  }

  ngOnDestroy(): void {
    // DestroyRef handles subscription cleanup via takeUntilDestroyed
  }
}
