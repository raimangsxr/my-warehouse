import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { SyncConflict, SyncService } from '../services/sync.service';
import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-conflicts',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Conflictos de sync</h1>
          <p class="page-subtitle">Resuelve divergencias de versión entre cliente y servidor</p>
        </div>
        <button mat-stroked-button type="button" (click)="reload()">Actualizar</button>
      </header>

      <mat-progress-bar *ngIf="loading" mode="indeterminate" />
      <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>

      <div class="list-grid" *ngIf="conflicts.length > 0; else noConflicts">
        <mat-card class="surface-card" *ngFor="let conflict of conflicts">
          <mat-card-content>
            <div class="list-row">
              <mat-icon>warning</mat-icon>
              <div class="grow">
                <p class="item-card-title">{{ conflict.entity_type }} · {{ conflict.entity_id }}</p>
                <div class="item-card-meta">
                  <span>Base: {{ conflict.base_version ?? 'n/a' }}</span>
                  <span>Server: {{ conflict.server_version ?? 'n/a' }}</span>
                  <span>{{ conflict.created_at | date:'short' }}</span>
                </div>
              </div>
            </div>

            <div class="item-card" style="margin-top: 8px">
              <div class="status-line"><strong>Command:</strong> {{ conflict.command_id }}</div>
              <div class="status-line"><strong>Payload:</strong> {{ conflict.client_payload | json }}</div>
            </div>

            <div class="inline-actions" style="margin-top: 10px">
              <button mat-stroked-button color="primary" type="button" (click)="resolve(conflict, 'keep_server')">
                Mantener servidor
              </button>
              <button mat-flat-button color="primary" type="button" (click)="resolve(conflict, 'keep_client')">
                Mantener cliente
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <ng-template #noConflicts>
        <div class="empty-state">No hay conflictos abiertos.</div>
      </ng-template>
    </div>
  `,
})
export class ConflictsComponent implements OnInit {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();

  loading = false;
  errorMessage = '';
  conflicts: SyncConflict[] = [];

  constructor(
    private readonly syncService: SyncService,
    private readonly warehouseService: WarehouseService
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  async reload(): Promise<void> {
    if (!this.selectedWarehouseId) {
      this.errorMessage = 'Selecciona un warehouse.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    try {
      await this.syncService.pull(this.selectedWarehouseId);
      this.conflicts = await this.syncService.listConflicts(this.selectedWarehouseId);
    } catch {
      this.errorMessage = 'No se pudo cargar la lista de conflictos.';
    } finally {
      this.loading = false;
    }
  }

  async resolve(conflict: SyncConflict, resolution: 'keep_server' | 'keep_client'): Promise<void> {
    if (!this.selectedWarehouseId) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    try {
      await this.syncService.resolveConflict(this.selectedWarehouseId, conflict.id, resolution);
      this.conflicts = await this.syncService.listConflicts(this.selectedWarehouseId);
    } catch {
      this.errorMessage = 'No se pudo resolver el conflicto.';
    } finally {
      this.loading = false;
    }
  }
}
