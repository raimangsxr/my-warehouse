import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';

import { BoxService, BoxTreeNode } from '../services/box.service';
import { Item, ItemService } from '../services/item.service';
import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-trash',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatListModule],
  template: `
    <div class="page-wide">
      <mat-card>
        <mat-card-title>Papelera</mat-card-title>
        <mat-card-content>
          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>

          <h3>Cajas eliminadas</h3>
          <mat-list>
            <mat-list-item *ngFor="let node of deletedBoxes">
              <div class="grow">{{ node.box.name }}</div>
              <button mat-button color="primary" (click)="restoreBox(node.box.id)">Restaurar</button>
            </mat-list-item>
          </mat-list>
          <div class="muted" *ngIf="deletedBoxes.length === 0">No hay cajas eliminadas.</div>

          <h3 style="margin-top: 16px">Artículos eliminados</h3>
          <mat-list>
            <mat-list-item *ngFor="let item of deletedItems">
              <div class="grow">{{ item.name }}</div>
              <button mat-button color="primary" (click)="restoreItem(item.id)">Restaurar</button>
            </mat-list-item>
          </mat-list>
          <div class="muted" *ngIf="deletedItems.length === 0">No hay artículos eliminados.</div>
        </mat-card-content>
      </mat-card>
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
