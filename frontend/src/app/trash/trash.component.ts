import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { BoxService, BoxTreeNode } from '../services/box.service';
import { Item, ItemService } from '../services/item.service';
import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-trash',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Papelera</h1>
          <p class="page-subtitle">Restaura cajas y artículos eliminados</p>
        </div>
      </header>

      <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>

      <div class="form-row">
        <mat-card class="surface-card">
          <mat-card-content>
            <h2 class="card-title">Cajas eliminadas</h2>
            <p class="card-subtitle">{{ deletedBoxes.length }} elementos</p>

            <div class="list-grid" *ngIf="deletedBoxes.length > 0; else noDeletedBoxes" style="margin-top: 10px">
              <article class="item-card" *ngFor="let node of deletedBoxes">
                <div class="list-row">
                  <mat-icon>inventory_2</mat-icon>
                  <p class="item-card-title grow">{{ node.box.name }}</p>
                  <button mat-stroked-button color="primary" type="button" (click)="restoreBox(node.box.id)">
                    Restaurar
                  </button>
                </div>
              </article>
            </div>

            <ng-template #noDeletedBoxes>
              <div class="empty-state">No hay cajas eliminadas.</div>
            </ng-template>
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card">
          <mat-card-content>
            <h2 class="card-title">Artículos eliminados</h2>
            <p class="card-subtitle">{{ deletedItems.length }} elementos</p>

            <div class="list-grid" *ngIf="deletedItems.length > 0; else noDeletedItems" style="margin-top: 10px">
              <article class="item-card" *ngFor="let item of deletedItems">
                <div class="list-row">
                  <mat-icon>inventory</mat-icon>
                  <p class="item-card-title grow">{{ item.name }}</p>
                  <button mat-stroked-button color="primary" type="button" (click)="restoreItem(item.id)">
                    Restaurar
                  </button>
                </div>
              </article>
            </div>

            <ng-template #noDeletedItems>
              <div class="empty-state">No hay artículos eliminados.</div>
            </ng-template>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `
})
export class TrashComponent implements OnInit {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();

  errorMessage = '';
  deletedBoxes: BoxTreeNode[] = [];
  deletedItems: Item[] = [];

  constructor(
    private readonly boxService: BoxService,
    private readonly itemService: ItemService,
    private readonly warehouseService: WarehouseService
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  restoreBox(boxId: string): void {
    if (!this.selectedWarehouseId) {
      return;
    }
    this.boxService.restore(this.selectedWarehouseId, boxId).subscribe({
      next: () => this.reload(),
      error: () => {
        this.errorMessage = 'No se pudo restaurar la caja (revisa si su padre está eliminado).';
      }
    });
  }

  restoreItem(itemId: string): void {
    if (!this.selectedWarehouseId) {
      return;
    }
    this.itemService.restore(this.selectedWarehouseId, itemId).subscribe({
      next: () => this.reload(),
      error: () => {
        this.errorMessage = 'No se pudo restaurar el artículo.';
      }
    });
  }

  private reload(): void {
    if (!this.selectedWarehouseId) {
      this.errorMessage = 'Selecciona un warehouse.';
      return;
    }
    this.errorMessage = '';

    this.boxService.tree(this.selectedWarehouseId, true).subscribe({
      next: (nodes) => {
        this.deletedBoxes = nodes.filter((node) => !!node.box.deleted_at);
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar la papelera de cajas.';
      }
    });

    this.itemService.list(this.selectedWarehouseId, { includeDeleted: true }).subscribe({
      next: (items) => {
        this.deletedItems = items.filter((item) => !!item.deleted_at);
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar la papelera de artículos.';
      }
    });
  }
}
