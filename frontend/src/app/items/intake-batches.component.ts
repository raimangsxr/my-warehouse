import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { BoxService, BoxTreeNode } from '../services/box.service';
import { IntakeBatch, IntakeService } from '../services/intake.service';
import { NotificationService } from '../services/notification.service';
import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-intake-batches',
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
          <h1 class="page-title">Lotes</h1>
          <p class="page-subtitle">Espacio temporal para capturar, procesar y guardar artículos por foto.</p>
        </div>
      </header>

      <mat-card class="surface-card compact-card">
        <mat-card-content>
          <h2 class="card-title">Nuevo lote</h2>
          <p class="card-subtitle">Crea un lote y continúa en su vista de detalle.</p>

          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
          <div class="status-line" *ngIf="boxLocked">
            Caja fijada por contexto: el lote se creará con la caja seleccionada.
          </div>

          <div class="form-row mt-8">
            <mat-form-field>
              <mat-label>Caja destino</mat-label>
              <mat-select [(ngModel)]="targetBoxId" [disabled]="boxLocked || creating">
                <mat-option *ngFor="let node of boxes" [value]="node.box.id">
                  {{ boxPathLabel(node) }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field class="grow">
              <mat-label>Nombre del lote (opcional)</mat-label>
              <input matInput [(ngModel)]="batchName" [disabled]="creating" maxlength="120" />
            </mat-form-field>

            <div class="inline-actions create-actions">
              <button mat-flat-button color="primary" type="button" (click)="createBatch()" [disabled]="creating || !targetBoxId">
                <mat-icon>add</mat-icon>
                Crear lote
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>
        <mat-card-content>
          <div class="card-header-row">
            <div>
              <h2 class="card-title">Listado de lotes</h2>
              <p class="card-subtitle">{{ batches.length }} lotes cargados</p>
            </div>
            <button mat-icon-button type="button" matTooltip="Actualizar listado" aria-label="Actualizar listado" (click)="loadBatches()">
              <mat-icon>refresh</mat-icon>
            </button>
          </div>

          <div class="empty-state" *ngIf="!loading && batches.length === 0">No hay lotes para este warehouse.</div>

          <div class="batch-list" *ngIf="batches.length > 0">
            <article class="batch-row" *ngFor="let batch of batches; trackBy: trackByBatchId">
              <div class="batch-main">
                <p class="batch-title">{{ batchTitle(batch) }}</p>
                <p class="batch-subtitle">
                  Estado {{ statusLabel(batch.status) }} · Creado hace {{ daysSinceCreated(batch.created_at) }} día(s)
                </p>
                <div class="inline-actions chips-row">
                  <span class="inline-chip">Nuevo: {{ countByUiStatus(batch, 'new') }}</span>
                  <span class="inline-chip">Procesado: {{ countByUiStatus(batch, 'processed') }}</span>
                  <span class="inline-chip">Error: {{ countByUiStatus(batch, 'error') }}</span>
                  <span class="inline-chip">Guardado: {{ countByUiStatus(batch, 'saved') }}</span>
                </div>
              </div>

              <div class="inline-actions batch-actions">
                <button
                  mat-icon-button
                  type="button"
                  matTooltip="Abrir lote"
                  aria-label="Abrir lote"
                  [routerLink]="['/app/batches', batch.id]"
                >
                  <mat-icon>open_in_new</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                  type="button"
                  matTooltip="Eliminar lote"
                  aria-label="Eliminar lote"
                  [disabled]="batch.status === 'processing'"
                  (click)="deleteBatch(batch)"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </article>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .batch-list {
        display: grid;
        gap: 8px;
      }

      .batch-row {
        border: 1px solid var(--border-soft);
        border-radius: 12px;
        background: linear-gradient(180deg, #ffffff 0%, #f6f9ff 100%);
        padding: 10px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
      }

      .batch-main {
        min-width: 0;
      }

      .batch-title {
        margin: 0;
        font-size: 0.98rem;
        font-weight: 600;
      }

      .batch-subtitle {
        margin: 2px 0 0;
        color: var(--text-2);
        font-size: 0.82rem;
      }

      .chips-row {
        margin-top: 8px;
        flex-wrap: wrap;
      }

      .batch-actions {
        display: inline-flex;
        gap: 2px;
      }

      @media (max-width: 760px) {
        .batch-row {
          grid-template-columns: 1fr;
        }

        .batch-actions {
          justify-content: flex-end;
        }
      }
    `
  ]
})
export class IntakeBatchesComponent implements OnInit, OnDestroy {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();

  boxes: BoxTreeNode[] = [];
  batches: IntakeBatch[] = [];
  batchName = '';
  targetBoxId: string | null = null;
  boxLocked = false;

  loading = false;
  creating = false;
  errorMessage = '';

  private readonly boxPathById = new Map<string, string>();
  private routeQuerySub?: Subscription;

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

    this.loadBoxes();
    this.loadBatches();

    this.routeQuerySub = this.route.queryParamMap.subscribe((params) => {
      const queryBatchId = params.get('batchId');
      if (queryBatchId) {
        this.router.navigate(['/app/batches', queryBatchId]).catch(() => {});
        return;
      }

      const queryBoxId = params.get('boxId');
      const lockBox = params.get('lockBox');
      this.boxLocked = lockBox === '1' || lockBox === 'true';
      if (queryBoxId) {
        this.targetBoxId = queryBoxId;
      }
    });
  }

  ngOnDestroy(): void {
    this.routeQuerySub?.unsubscribe();
  }

  trackByBatchId(_index: number, batch: IntakeBatch): string {
    return batch.id;
  }

  boxPathLabel(node: BoxTreeNode): string {
    return this.boxPathById.get(node.box.id) || node.box.name;
  }

  batchTitle(batch: IntakeBatch): string {
    return batch.name || `Lote ${batch.id.slice(0, 8)}`;
  }

  statusLabel(status: IntakeBatch['status']): string {
    const labels: Record<IntakeBatch['status'], string> = {
      drafting: 'Activo',
      processing: 'Procesando',
      review: 'Revisión',
      committed: 'Completado'
    };
    return labels[status] || status;
  }

  countByUiStatus(batch: IntakeBatch, status: 'new' | 'processed' | 'error' | 'saved'): number {
    const counts = batch.status_counts || {};
    if (status === 'new') {
      return (counts['uploaded'] || 0) + (counts['processing'] || 0);
    }
    if (status === 'processed') {
      return (counts['ready'] || 0) + (counts['review'] || 0);
    }
    if (status === 'error') {
      return (counts['error'] || 0) + (counts['rejected'] || 0);
    }
    return counts['committed'] || 0;
  }

  daysSinceCreated(createdAt: string): number {
    const createdMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdMs)) {
      return 0;
    }
    const elapsed = Date.now() - createdMs;
    return Math.max(0, Math.floor(elapsed / 86_400_000));
  }

  createBatch(): void {
    if (!this.selectedWarehouseId || !this.targetBoxId || this.creating) {
      return;
    }

    this.creating = true;
    this.errorMessage = '';
    this.intakeService
      .createBatch(this.selectedWarehouseId, {
        target_box_id: this.targetBoxId,
        name: this.batchName.trim() || null
      })
      .pipe(finalize(() => (this.creating = false)))
      .subscribe({
        next: (response) => {
          this.notificationService.success('Lote creado.');
          this.batchName = '';
          this.router.navigate(['/app/batches', response.batch.id]).catch(() => {});
        },
        error: () => {
          this.setActionError('No se pudo crear el lote.');
        }
      });
  }

  deleteBatch(batch: IntakeBatch): void {
    if (!this.selectedWarehouseId || batch.status === 'processing') {
      return;
    }

    const label = this.batchTitle(batch);
    const confirmed = window.confirm(`¿Eliminar el lote "${label}"? Esta acción no se puede deshacer.`);
    if (!confirmed) {
      return;
    }

    this.intakeService.deleteBatch(this.selectedWarehouseId, batch.id).subscribe({
      next: () => {
        this.batches = this.batches.filter((row) => row.id !== batch.id);
        this.notificationService.success('Lote eliminado.');
      },
      error: () => {
        this.setActionError('No se pudo eliminar el lote.');
      }
    });
  }

  loadBatches(): void {
    if (!this.selectedWarehouseId) {
      this.batches = [];
      return;
    }

    this.loading = true;
    this.intakeService
      .listBatches(this.selectedWarehouseId, {
        include_committed: true,
        only_mine: false,
        limit: 80
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (batches) => {
          this.batches = batches;
        },
        error: () => {
          this.batches = [];
          this.setActionError('No se pudo cargar el listado de lotes.');
        }
      });
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

  private setActionError(message: string): void {
    this.errorMessage = message;
    this.notificationService.error(message);
  }
}
