import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { BoxService, BoxTreeNode } from '../services/box.service';
import {
  IntakeBatch,
  IntakeBatchStatus,
  IntakeDraft,
  IntakeDraftStatus,
  IntakeService
} from '../services/intake.service';
import { NotificationService } from '../services/notification.service';
import { WarehouseService } from '../services/warehouse.service';

interface DraftEditorState {
  name: string;
  description: string;
  tagsText: string;
  aliasesText: string;
}

@Component({
  selector: 'app-item-intake-batch',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Captura masiva por caja</h1>
          <p class="page-subtitle">
            Sube N fotos, procesa en paralelo y valida nombre, descripción, tags y aliases antes de crear artículos.
          </p>
        </div>
      </header>

      <mat-card class="surface-card">
        <mat-card-content>
          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
          <div class="status-line" *ngIf="boxLocked">
            Caja fijada por contexto: los artículos del lote se crearán en la caja seleccionada.
          </div>

          <div class="form-row">
            <mat-form-field>
              <mat-label>Caja destino</mat-label>
              <mat-select [(ngModel)]="targetBoxId" [disabled]="boxLocked || !!batch">
                <mat-option *ngFor="let node of boxes" [value]="node.box.id">
                  {{ boxPathLabel(node) }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field class="grow">
              <mat-label>Nombre del lote (opcional)</mat-label>
              <input matInput [(ngModel)]="batchName" [disabled]="!!batch" maxlength="120" />
            </mat-form-field>
          </div>

          <div class="inline-actions create-actions">
            <button mat-flat-button color="primary" type="button" (click)="createBatch()" [disabled]="loading || !!batch || !targetBoxId">
              Crear lote
            </button>
            <button mat-stroked-button type="button" [routerLink]="cancelLink">Cancelar</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card" *ngIf="batch">
        <mat-progress-bar *ngIf="isProcessing" mode="indeterminate"></mat-progress-bar>
        <mat-card-content>
          <section class="batch-toolbar">
            <div>
              <p class="results-title">Lote {{ batch.name || batch.id.slice(0, 8) }}</p>
              <p class="results-count">
                Estado {{ statusLabel(batch.status) }} · {{ batch.committed_count }}/{{ batch.total_count }} comprometidos
              </p>
            </div>
            <div class="inline-actions wrap-actions batch-actions">
              <button mat-flat-button color="primary" type="button" (click)="openPicker()" [disabled]="uploading || isProcessing">
                <mat-icon>add_a_photo</mat-icon>
                Añadir fotos
              </button>
              <button mat-stroked-button type="button" (click)="startProcessing(false)" [disabled]="isProcessing || uploadedCount === 0">
                Procesar pendientes
              </button>
              <button mat-stroked-button type="button" (click)="acceptAllReview()" [disabled]="reviewCount === 0 || isProcessing">
                Aceptar revisión
              </button>
              <button mat-stroked-button type="button" (click)="startProcessing(true)" [disabled]="isProcessing || errorCount === 0">
                Reintentar errores
              </button>
              <button
                mat-flat-button
                color="accent"
                type="button"
                class="batch-action-primary"
                (click)="commitReady()"
                [disabled]="isProcessing || readyCount === 0 || committing"
              >
                Crear {{ readyCount }} artículos
              </button>
            </div>
          </section>

          <input
            #photoInput
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.heic,.heif"
            capture="environment"
            multiple
            (change)="onFilesSelected($event)"
            class="sr-only-input"
          />

          <div class="inline-actions chips-row mt-10">
            <span class="inline-chip">Subidas: {{ uploadedCount }}</span>
            <span class="inline-chip">Procesando: {{ processingCount }}</span>
            <span class="inline-chip">Listas: {{ readyCount }}</span>
            <span class="inline-chip">Revisión: {{ reviewCount }}</span>
            <span class="inline-chip">Errores: {{ errorCount }}</span>
            <span class="inline-chip">Rechazadas: {{ rejectedCount }}</span>
            <span class="inline-chip">Comprometidas: {{ committedCount }}</span>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card" *ngIf="batch">
        <mat-card-content>
          <div class="empty-state" *ngIf="drafts.length === 0">Todavía no hay fotos en este lote.</div>

          <div class="drafts-grid" *ngIf="drafts.length > 0">
            <article class="draft-card" *ngFor="let draft of drafts; trackBy: trackByDraftId">
              <img [src]="draft.photo_url" [alt]="draft.name || 'Borrador'" class="draft-photo" />
              <div class="draft-body">
                <div class="draft-head">
                  <span class="inline-chip">{{ statusLabel(draft.status) }}</span>
                  <span class="inline-chip" *ngIf="draft.confidence > 0">Conf {{ confidencePercent(draft.confidence) }}%</span>
                </div>

                <mat-form-field class="full-width compact-field">
                  <mat-label>Nombre</mat-label>
                  <input matInput [(ngModel)]="editorFor(draft).name" [disabled]="isDraftLocked(draft)" maxlength="160" />
                </mat-form-field>

                <mat-form-field class="full-width compact-field">
                  <mat-label>Descripción</mat-label>
                  <textarea
                    matInput
                    rows="2"
                    [(ngModel)]="editorFor(draft).description"
                    [disabled]="isDraftLocked(draft)"
                    maxlength="1000"
                  ></textarea>
                </mat-form-field>

                <div class="form-row compact-row">
                  <mat-form-field class="compact-field">
                    <mat-label>Tags</mat-label>
                    <input matInput [(ngModel)]="editorFor(draft).tagsText" [disabled]="isDraftLocked(draft)" />
                  </mat-form-field>

                  <mat-form-field class="compact-field">
                    <mat-label>Aliases</mat-label>
                    <input matInput [(ngModel)]="editorFor(draft).aliasesText" [disabled]="isDraftLocked(draft)" />
                  </mat-form-field>
                </div>

                <p class="status-line" *ngIf="draft.warnings.length > 0">{{ draft.warnings.join(' · ') }}</p>
                <p class="error" *ngIf="draft.error_message">{{ draft.error_message }}</p>

                <div class="inline-actions draft-action-icons">
                  <button
                    mat-icon-button
                    type="button"
                    matTooltip="Guardar borrador"
                    aria-label="Guardar borrador"
                    (click)="saveDraft(draft)"
                    [disabled]="isDraftLocked(draft)"
                  >
                    <mat-icon>save</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    type="button"
                    matTooltip="Marcar como listo"
                    aria-label="Marcar como listo"
                    (click)="setDraftStatus(draft, 'ready')"
                    [disabled]="isDraftLocked(draft)"
                  >
                    <mat-icon>check_circle</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    type="button"
                    matTooltip="Marcar para revisión"
                    aria-label="Marcar para revisión"
                    (click)="setDraftStatus(draft, 'review')"
                    [disabled]="isDraftLocked(draft)"
                  >
                    <mat-icon>rate_review</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    color="warn"
                    type="button"
                    matTooltip="Rechazar borrador"
                    aria-label="Rechazar borrador"
                    (click)="setDraftStatus(draft, 'rejected')"
                    [disabled]="isDraftLocked(draft)"
                  >
                    <mat-icon>block</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    type="button"
                    matTooltip="Reintentar IA"
                    aria-label="Reintentar IA"
                    (click)="retryDraft(draft)"
                    [disabled]="isProcessing || draft.status === 'committed'"
                  >
                    <mat-icon>auto_awesome</mat-icon>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .sr-only-input {
        display: none;
      }

      .batch-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .wrap-actions {
        flex-wrap: wrap;
      }

      .create-actions .mat-mdc-button-base,
      .batch-actions .mat-mdc-button-base {
        min-height: 40px;
      }

      .chips-row {
        flex-wrap: wrap;
      }

      .drafts-grid {
        display: grid;
        gap: 10px;
      }

      .draft-card {
        display: grid;
        grid-template-columns: 116px minmax(0, 1fr);
        gap: 10px;
        border: 1px solid var(--border-soft);
        border-radius: 12px;
        padding: 10px;
        background: #ffffff;
      }

      .draft-photo {
        width: 100%;
        height: 116px;
        object-fit: cover;
        border-radius: 10px;
        border: 1px solid var(--border-soft);
        background: #f4f7fc;
      }

      .draft-body {
        min-width: 0;
      }

      .draft-head {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 6px;
      }

      .compact-row {
        gap: 8px;
      }

      .compact-field {
        margin-bottom: -1.05em;
      }

      .draft-action-icons {
        gap: 4px;
      }

      @media (max-width: 760px) {
        .create-actions,
        .batch-actions {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .create-actions .mat-mdc-button-base,
        .batch-actions .mat-mdc-button-base {
          width: 100%;
          justify-content: center;
          margin: 0;
        }

        .batch-action-primary {
          grid-column: 1 / -1;
        }

        .draft-card {
          grid-template-columns: 1fr;
        }

        .draft-photo {
          height: 190px;
        }
      }
    `
  ]
})
export class ItemIntakeBatchComponent implements OnInit, OnDestroy {
  @ViewChild('photoInput') photoInput?: ElementRef<HTMLInputElement>;

  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();

  boxes: BoxTreeNode[] = [];
  targetBoxId: string | null = null;
  boxLocked = false;
  cancelLink: string[] = ['/app/home'];

  batchName = '';
  batch: IntakeBatch | null = null;
  drafts: IntakeDraft[] = [];

  loading = false;
  uploading = false;
  committing = false;
  errorMessage = '';

  private readonly draftEditors = new Map<string, DraftEditorState>();
  private readonly boxPathById = new Map<string, string>();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly warehouseService: WarehouseService,
    private readonly boxService: BoxService,
    private readonly intakeService: IntakeService,
    private readonly notificationService: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (!this.selectedWarehouseId) {
      this.router.navigateByUrl('/warehouses');
      return;
    }

    const queryBoxId = this.route.snapshot.queryParamMap.get('boxId');
    const lockBox = this.route.snapshot.queryParamMap.get('lockBox');
    const queryBatchId = this.route.snapshot.queryParamMap.get('batchId');

    if (queryBoxId) {
      this.targetBoxId = queryBoxId;
      this.cancelLink = ['/app/boxes', queryBoxId];
    }
    this.boxLocked = lockBox === '1' || lockBox === 'true';

    this.loadBoxes();

    if (queryBatchId) {
      this.loadBatch(queryBatchId);
    }
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  createBatch(): void {
    if (!this.selectedWarehouseId || !this.targetBoxId || this.loading || this.batch) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.intakeService
      .createBatch(this.selectedWarehouseId, {
        target_box_id: this.targetBoxId,
        name: this.batchName.trim() || null
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          this.applyBatchPayload(response.batch, response.drafts);
          this.notificationService.success('Lote creado. Puedes empezar a subir fotos.');
          this.router
            .navigate([], {
              relativeTo: this.route,
              queryParams: {
                boxId: this.targetBoxId,
                lockBox: this.boxLocked ? 1 : null,
                batchId: response.batch.id
              },
              queryParamsHandling: 'merge'
            })
            .catch(() => {});
        },
        error: () => {
          this.setActionError('No se pudo crear el lote.');
        }
      });
  }

  openPicker(): void {
    if (!this.batch || this.isProcessing) {
      return;
    }
    const input = this.photoInput?.nativeElement;
    if (!input) {
      return;
    }
    input.value = '';
    input.click();
  }

  onFilesSelected(event: Event): void {
    if (!this.selectedWarehouseId || !this.batch || this.uploading) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) {
      return;
    }

    this.uploading = true;
    this.errorMessage = '';
    this.intakeService
      .uploadPhotos(this.selectedWarehouseId, this.batch.id, files)
      .pipe(finalize(() => (this.uploading = false)))
      .subscribe({
        next: (response) => {
          this.batch = response.batch;
          this.notificationService.success(`${response.uploaded_count} foto(s) añadidas al lote.`);
          this.loadBatch(this.batch.id, true);
          this.startProcessing(false);
        },
        error: () => {
          this.setActionError('No se pudieron subir las fotos seleccionadas.');
        }
      });
  }

  startProcessing(retryErrors: boolean): void {
    if (!this.selectedWarehouseId || !this.batch || this.isProcessing) {
      return;
    }

    this.intakeService.startBatch(this.selectedWarehouseId, this.batch.id, retryErrors).subscribe({
      next: (response) => {
        this.batch = response.batch;
        this.notificationService.info(response.message);
        this.startAutoRefresh();
      },
      error: () => {
        this.setActionError('No se pudo iniciar el procesamiento del lote.');
      }
    });
  }

  saveDraft(draft: IntakeDraft): void {
    if (!this.selectedWarehouseId || this.isDraftLocked(draft)) {
      return;
    }

    const editor = this.editorFor(draft);
    this.intakeService
      .updateDraft(this.selectedWarehouseId, draft.id, {
        name: editor.name.trim() || null,
        description: editor.description.trim() || null,
        tags: splitCsv(editor.tagsText),
        aliases: splitCsv(editor.aliasesText)
      })
      .subscribe({
        next: (updated) => {
          this.replaceDraft(updated);
          this.notificationService.success('Borrador actualizado.');
        },
        error: () => {
          this.setActionError('No se pudo guardar el borrador.');
        }
      });
  }

  setDraftStatus(draft: IntakeDraft, statusValue: IntakeDraftStatus): void {
    if (!this.selectedWarehouseId || this.isDraftLocked(draft)) {
      return;
    }

    const editor = this.editorFor(draft);
    this.intakeService
      .updateDraft(this.selectedWarehouseId, draft.id, {
        name: editor.name.trim() || null,
        description: editor.description.trim() || null,
        tags: splitCsv(editor.tagsText),
        aliases: splitCsv(editor.aliasesText),
        status: statusValue
      })
      .subscribe({
        next: (updated) => {
          this.replaceDraft(updated);
          this.refreshBatchRollupFromDrafts();
        },
        error: () => {
          this.setActionError('No se pudo actualizar el estado del borrador.');
        }
      });
  }

  retryDraft(draft: IntakeDraft): void {
    if (!this.selectedWarehouseId || !this.batch || draft.status === 'committed' || this.isProcessing) {
      return;
    }

    const editor = this.editorFor(draft);
    this.intakeService
      .updateDraft(this.selectedWarehouseId, draft.id, {
        name: editor.name.trim() || null,
        description: editor.description.trim() || null,
        tags: splitCsv(editor.tagsText),
        aliases: splitCsv(editor.aliasesText),
        status: 'uploaded'
      })
      .subscribe({
        next: () => {
          this.loadBatch(this.batch!.id, true);
          this.startProcessing(false);
        },
        error: () => {
          this.setActionError('No se pudo reencolar el borrador para análisis.');
        }
      });
  }

  acceptAllReview(): void {
    if (!this.selectedWarehouseId || this.reviewCount === 0) {
      return;
    }

    const requests = this.drafts
      .filter((draft) => draft.status === 'review')
      .map((draft) => {
        const editor = this.editorFor(draft);
        return this.intakeService
          .updateDraft(this.selectedWarehouseId!, draft.id, {
            name: editor.name.trim() || null,
            description: editor.description.trim() || null,
            tags: splitCsv(editor.tagsText),
            aliases: splitCsv(editor.aliasesText),
            status: 'ready'
          })
          .pipe(catchError(() => of(null)));
      });

    if (requests.length === 0) {
      return;
    }

    forkJoin(requests).subscribe({
      next: (results) => {
        const updated = results.filter((row): row is IntakeDraft => !!row);
        if (updated.length > 0) {
          updated.forEach((draft) => this.replaceDraft(draft));
          this.refreshBatchRollupFromDrafts();
          this.notificationService.success(`Se marcaron ${updated.length} borradores como listos.`);
        }
      },
      error: () => {
        this.setActionError('No se pudieron aceptar todos los borradores en revisión.');
      }
    });
  }

  commitReady(): void {
    if (!this.selectedWarehouseId || !this.batch || this.readyCount === 0 || this.committing) {
      return;
    }

    this.committing = true;
    this.intakeService
      .commitBatch(this.selectedWarehouseId, this.batch.id)
      .pipe(finalize(() => (this.committing = false)))
      .subscribe({
        next: (response) => {
          this.batch = response.batch;
          this.loadBatch(response.batch.id, true);
          this.notificationService.success(`Se crearon ${response.created} artículos en la caja destino.`);
        },
        error: () => {
          this.setActionError('No se pudo completar el commit del lote.');
        }
      });
  }

  statusLabel(statusValue: IntakeDraftStatus | IntakeBatchStatus): string {
    const labels: Record<string, string> = {
      drafting: 'Borrador',
      processing: 'Procesando',
      review: 'Revisión',
      committed: 'Comprometido',
      uploaded: 'Subida',
      ready: 'Lista',
      rejected: 'Rechazada',
      error: 'Error'
    };
    return labels[statusValue] || statusValue;
  }

  editorFor(draft: IntakeDraft): DraftEditorState {
    const existing = this.draftEditors.get(draft.id);
    if (existing) {
      return existing;
    }

    const nextState: DraftEditorState = {
      name: draft.name || '',
      description: draft.description || '',
      tagsText: (draft.tags || []).join(', '),
      aliasesText: (draft.aliases || []).join(', ')
    };
    this.draftEditors.set(draft.id, nextState);
    return nextState;
  }

  boxPathLabel(node: BoxTreeNode): string {
    return this.boxPathById.get(node.box.id) || node.box.name;
  }

  trackByDraftId(_index: number, draft: IntakeDraft): string {
    return draft.id;
  }

  confidencePercent(value: number): number {
    return Math.round(value * 100);
  }

  isDraftLocked(draft: IntakeDraft): boolean {
    return this.isProcessing || draft.status === 'committed' || this.committing;
  }

  get isProcessing(): boolean {
    return this.batch?.status === 'processing' || this.processingCount > 0;
  }

  get uploadedCount(): number {
    return this.countByStatus('uploaded');
  }

  get processingCount(): number {
    return this.countByStatus('processing');
  }

  get readyCount(): number {
    return this.countByStatus('ready');
  }

  get reviewCount(): number {
    return this.countByStatus('review');
  }

  get errorCount(): number {
    return this.countByStatus('error');
  }

  get rejectedCount(): number {
    return this.countByStatus('rejected');
  }

  get committedCount(): number {
    return this.countByStatus('committed');
  }

  private countByStatus(statusValue: IntakeDraftStatus): number {
    return this.drafts.filter((draft) => draft.status === statusValue).length;
  }

  private loadBoxes(): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    this.boxService.tree(this.selectedWarehouseId).subscribe({
      next: (nodes) => {
        this.boxes = nodes;
        this.boxPathById.clear();

        const pathByLevel: string[] = [];
        nodes.forEach((node) => {
          pathByLevel[node.level] = node.box.name;
          pathByLevel.length = node.level + 1;
          this.boxPathById.set(node.box.id, pathByLevel.join(' > '));
        });

        if (!this.targetBoxId && nodes.length > 0) {
          this.targetBoxId = nodes[0].box.id;
        }
      },
      error: () => {
        this.setActionError('No se pudieron cargar las cajas del warehouse.');
      }
    });
  }

  private loadBatch(batchId: string, silent = false): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    this.intakeService.getBatch(this.selectedWarehouseId, batchId).subscribe({
      next: (response) => {
        this.applyBatchPayload(response.batch, response.drafts);
        if (this.batch?.status === 'processing' || this.processingCount > 0 || this.uploadedCount > 0) {
          this.startAutoRefresh();
        } else {
          this.stopAutoRefresh();
        }
      },
      error: () => {
        if (!silent) {
          this.setActionError('No se pudo cargar el lote de captura masiva.');
        }
      }
    });
  }

  private applyBatchPayload(batch: IntakeBatch, drafts: IntakeDraft[]): void {
    this.batch = batch;
    this.drafts = drafts;
    this.targetBoxId = batch.target_box_id;

    const validIds = new Set(drafts.map((draft) => draft.id));
    Array.from(this.draftEditors.keys()).forEach((id) => {
      if (!validIds.has(id)) {
        this.draftEditors.delete(id);
      }
    });

    drafts.forEach((draft) => {
      this.draftEditors.set(draft.id, {
        name: draft.name || '',
        description: draft.description || '',
        tagsText: (draft.tags || []).join(', '),
        aliasesText: (draft.aliases || []).join(', ')
      });
    });
  }

  private replaceDraft(updated: IntakeDraft): void {
    const index = this.drafts.findIndex((draft) => draft.id === updated.id);
    if (index < 0) {
      return;
    }

    const next = [...this.drafts];
    next[index] = updated;
    this.drafts = next;
    this.draftEditors.set(updated.id, {
      name: updated.name || '',
      description: updated.description || '',
      tagsText: (updated.tags || []).join(', '),
      aliasesText: (updated.aliases || []).join(', ')
    });
  }

  private refreshBatchRollupFromDrafts(): void {
    if (!this.batch) {
      return;
    }

    const statusCounts: Record<string, number> = {
      uploaded: this.uploadedCount,
      processing: this.processingCount,
      ready: this.readyCount,
      review: this.reviewCount,
      rejected: this.rejectedCount,
      error: this.errorCount,
      committed: this.committedCount
    };

    this.batch = {
      ...this.batch,
      total_count: this.drafts.length,
      processed_count: this.readyCount + this.reviewCount + this.rejectedCount + this.errorCount + this.committedCount,
      committed_count: this.committedCount,
      status_counts: statusCounts
    };
  }

  private startAutoRefresh(): void {
    if (this.refreshTimer || !this.batch || !this.selectedWarehouseId) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      if (!this.batch || !this.selectedWarehouseId) {
        this.stopAutoRefresh();
        return;
      }
      this.loadBatch(this.batch.id, true);
    }, 2000);
  }

  private stopAutoRefresh(): void {
    if (!this.refreshTimer) {
      return;
    }
    clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  private setActionError(message: string): void {
    this.errorMessage = message;
    this.notificationService.error(message);
  }
}

function splitCsv(raw: string | null | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part, index, arr) => !!part && arr.indexOf(part) === index);
}
