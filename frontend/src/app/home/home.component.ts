import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { BoxService } from '../services/box.service';
import { Item, ItemService, TagCloudEntry } from '../services/item.service';
import { SyncService } from '../services/sync.service';
import { WarehouseService } from '../services/warehouse.service';

interface BoxMoveOption {
  id: string;
  level: number;
  path_label: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatChipsModule,
    MatSelectModule,
    MatProgressBarModule
  ],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Inicio</h1>
          <p class="page-subtitle">Consulta rápida de artículos, favoritos y stock por warehouse</p>
        </div>
        <button mat-flat-button color="primary" [routerLink]="['/app/items/new']">
          <mat-icon>add</mat-icon>
          Nuevo elemento
        </button>
      </header>

      <mat-card class="surface-card">
        <mat-card-content>
          <div class="card-header-row">
            <div>
              <h2 class="card-title">Búsqueda y filtros</h2>
              <p class="card-subtitle">Filtra por texto, estado de stock, favoritos y tags</p>
            </div>
          </div>

          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>

          <form [formGroup]="filtersForm" class="form-stack" (ngSubmit)="loadItems()">
            <div class="form-row">
              <mat-form-field class="grow">
                <mat-label>Buscar artículo</mat-label>
                <mat-icon matPrefix>search</mat-icon>
                <input matInput formControlName="q" placeholder="nombre, tags, alias, ubicación" />
              </mat-form-field>
              <div class="inline-actions">
                <mat-checkbox class="filter-checkbox" formControlName="favoritesOnly">Solo favoritos</mat-checkbox>
                <mat-checkbox class="filter-checkbox" formControlName="stockZero">Stock = 0</mat-checkbox>
              </div>
            </div>

            <div class="inline-actions">
              <button mat-flat-button color="primary" type="submit">Buscar</button>
              <button mat-stroked-button type="button" (click)="clearFilters()">Limpiar</button>
            </div>

            <div class="inline-actions" *ngIf="tagsCloud.length > 0">
              <span class="muted">Tags:</span>
              <mat-chip-set>
                <mat-chip-option
                  *ngFor="let tag of tagsCloud"
                  [selected]="activeTag === tag.tag"
                  (click)="toggleTag(tag.tag)"
                >
                  {{ tag.tag }} ({{ tag.count }})
                </mat-chip-option>
              </mat-chip-set>
              <button mat-button type="button" *ngIf="activeTag" (click)="toggleTag(activeTag)">Quitar tag</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-content>
          <div class="card-header-row">
            <div>
              <h2 class="card-title">Acciones por lote</h2>
              <p class="card-subtitle">Seleccionados: {{ selectedItemIds.size }}</p>
            </div>
          </div>

          <div class="form-row">
              <mat-form-field>
                <mat-label>Mover seleccionados a caja</mat-label>
                <mat-select [(ngModel)]="targetBoxId" [ngModelOptions]="{ standalone: true }">
                  <mat-option *ngFor="let box of boxes" [value]="box.id">
                    <span class="tree-option-label">
                      <span class="tree-option-level">N{{ box.level }}</span>
                      {{ box.path_label }}
                    </span>
                  </mat-option>
                </mat-select>
              </mat-form-field>

            <div class="inline-actions">
              <button mat-stroked-button type="button" (click)="batchMove()" [disabled]="selectedItemIds.size === 0 || !targetBoxId">
                Mover
              </button>
              <button mat-stroked-button type="button" (click)="batchFavorite(true)" [disabled]="selectedItemIds.size === 0">
                Marcar favorito
              </button>
              <button mat-stroked-button type="button" (click)="batchFavorite(false)" [disabled]="selectedItemIds.size === 0">
                Quitar favorito
              </button>
              <button mat-flat-button color="warn" type="button" (click)="batchDelete()" [disabled]="selectedItemIds.size === 0">
                Borrar
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-progress-bar *ngIf="loadingItems" mode="indeterminate" />

      <div class="items-grid" *ngIf="items.length > 0; else emptyItems" style="margin-top: 14px">
        <article class="item-card item-card-compact" *ngFor="let item of items">
          <div class="item-card-top">
            <div class="item-card-left">
              <mat-checkbox
                class="item-select-checkbox"
                [checked]="selectedItemIds.has(item.id)"
                (change)="toggleSelected(item.id)"
              ></mat-checkbox>
              <div class="item-card-headings">
                <p class="item-card-title">{{ item.name }}</p>
                <p class="item-card-path">{{ item.box_path.join(' > ') }}</p>
              </div>
            </div>
            <div class="item-card-right">
              <span class="inline-chip stock-chip">Stock: {{ item.stock }}</span>
              <button
                mat-icon-button
                class="compact-icon-action"
                (click)="toggleFavorite(item)"
                [attr.aria-label]="'Favorito ' + item.name"
              >
                <mat-icon>{{ item.is_favorite ? 'star' : 'star_border' }}</mat-icon>
              </button>
            </div>
          </div>

          <p class="status-line item-card-description">{{ item.description || 'Sin descripción' }}</p>

          <div class="item-card-actions">
            <button
              mat-icon-button
              color="primary"
              class="compact-icon-action"
              type="button"
              (click)="adjustStock(item, 1)"
              [attr.aria-label]="'Incrementar stock de ' + item.name"
            >
              <mat-icon>add</mat-icon>
            </button>
            <button
              mat-icon-button
              class="compact-icon-action"
              type="button"
              (click)="adjustStock(item, -1)"
              [attr.aria-label]="'Reducir stock de ' + item.name"
            >
              <mat-icon>remove</mat-icon>
            </button>
            <button mat-button type="button" class="compact-text-action" [routerLink]="['/app/items', item.id]">
              <mat-icon>edit</mat-icon>
              Editar
            </button>
            <button mat-button color="warn" type="button" class="compact-text-action" (click)="deleteItem(item)">
              <mat-icon>delete</mat-icon>
              Borrar
            </button>
          </div>
        </article>
      </div>

      <ng-template #emptyItems>
        <div class="empty-state" style="margin-top: 14px">
          No hay artículos para los filtros seleccionados.
        </div>
      </ng-template>
    </div>
  `
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();
  private readonly destroy$ = new Subject<void>();

  errorMessage = '';
  loadingItems = false;
  items: Item[] = [];
  boxes: BoxMoveOption[] = [];
  tagsCloud: TagCloudEntry[] = [];
  activeTag: string | null = null;
  targetBoxId: string | null = null;
  selectedItemIds = new Set<string>();

  readonly filtersForm = this.fb.nonNullable.group({
    q: [''],
    favoritesOnly: false,
    stockZero: false
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly itemService: ItemService,
    private readonly boxService: BoxService,
    private readonly syncService: SyncService,
    private readonly warehouseService: WarehouseService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (!this.selectedWarehouseId) {
      this.router.navigateByUrl('/warehouses');
      return;
    }

    this.loadBoxes();
    this.loadTagsCloud();
    this.loadItems();

    this.filtersForm.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.loadItems());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadItems(): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    const raw = this.filtersForm.getRawValue();
    this.loadingItems = true;
    this.itemService
      .list(this.selectedWarehouseId, {
        q: raw.q,
        tag: this.activeTag || undefined,
        favoritesOnly: raw.favoritesOnly,
        stockZero: raw.stockZero
      })
      .subscribe({
        next: (items) => {
          this.loadingItems = false;
          this.items = items;
          this.selectedItemIds.clear();
        },
        error: () => {
          this.loadingItems = false;
          this.errorMessage = 'No se pudieron cargar los artículos.';
        }
      });
  }

  clearFilters(): void {
    this.activeTag = null;
    this.filtersForm.reset({ q: '', favoritesOnly: false, stockZero: false });
    this.loadItems();
  }

  toggleTag(tag: string): void {
    this.activeTag = this.activeTag === tag ? null : tag;
    this.loadItems();
  }

  toggleFavorite(item: Item): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    const nextFavorite = !item.is_favorite;
    const commandId = crypto.randomUUID();
    this.itemService.setFavorite(this.selectedWarehouseId, item.id, nextFavorite).subscribe({
      next: (updated) => {
        this.upsertItem(updated);
      },
      error: async () => {
        await this.syncService.enqueueCommand(this.selectedWarehouseId!, {
          command_id: commandId,
          type: nextFavorite ? 'item.favorite' : 'item.unfavorite',
          entity_id: item.id,
          payload: {},
        });
        this.upsertItem({ ...item, is_favorite: nextFavorite });
        this.errorMessage = 'Sin conexión: favorito en cola para sincronizar.';
      }
    });
  }

  adjustStock(item: Item, delta: 1 | -1): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    const commandId = crypto.randomUUID();
    this.itemService.adjustStock(this.selectedWarehouseId, item.id, delta, commandId).subscribe({
      next: (updated) => {
        this.upsertItem(updated);
      },
      error: async () => {
        await this.syncService.enqueueCommand(this.selectedWarehouseId!, {
          command_id: commandId,
          type: 'stock.adjust',
          entity_id: item.id,
          payload: { delta },
        });
        this.upsertItem({ ...item, stock: item.stock + delta });
        this.errorMessage = 'Sin conexión: ajuste de stock en cola para sincronizar.';
      }
    });
  }

  deleteItem(item: Item): void {
    if (!this.selectedWarehouseId) {
      return;
    }
    if (!confirm(`¿Enviar "${item.name}" a papelera?`)) {
      return;
    }

    this.itemService.delete(this.selectedWarehouseId, item.id).subscribe({
      next: () => {
        this.items = this.items.filter((it) => it.id !== item.id);
        this.selectedItemIds.delete(item.id);
      },
      error: () => {
        this.errorMessage = 'No se pudo borrar el artículo.';
      }
    });
  }

  toggleSelected(itemId: string): void {
    if (this.selectedItemIds.has(itemId)) {
      this.selectedItemIds.delete(itemId);
      return;
    }
    this.selectedItemIds.add(itemId);
  }

  batchMove(): void {
    if (!this.selectedWarehouseId || !this.targetBoxId || this.selectedItemIds.size === 0) {
      return;
    }

    this.itemService
      .batch(this.selectedWarehouseId, {
        item_ids: [...this.selectedItemIds],
        action: 'move',
        target_box_id: this.targetBoxId
      })
      .subscribe({
        next: () => this.loadItems(),
        error: () => {
          this.errorMessage = 'No se pudo mover el lote.';
        }
      });
  }

  batchFavorite(value: boolean): void {
    if (!this.selectedWarehouseId || this.selectedItemIds.size === 0) {
      return;
    }

    this.itemService
      .batch(this.selectedWarehouseId, {
        item_ids: [...this.selectedItemIds],
        action: value ? 'favorite' : 'unfavorite'
      })
      .subscribe({
        next: () => this.loadItems(),
        error: () => {
          this.errorMessage = 'No se pudo actualizar favoritos en lote.';
        }
      });
  }

  batchDelete(): void {
    if (!this.selectedWarehouseId || this.selectedItemIds.size === 0) {
      return;
    }
    if (!confirm('¿Borrar los artículos seleccionados?')) {
      return;
    }

    this.itemService
      .batch(this.selectedWarehouseId, {
        item_ids: [...this.selectedItemIds],
        action: 'delete'
      })
      .subscribe({
        next: () => this.loadItems(),
        error: () => {
          this.errorMessage = 'No se pudo borrar el lote.';
        }
      });
  }

  private loadBoxes(): void {
    if (!this.selectedWarehouseId) {
      return;
    }
    this.boxService.tree(this.selectedWarehouseId).subscribe({
      next: (nodes) => {
        const pathByLevel: string[] = [];
        this.boxes = nodes.map((node) => {
          pathByLevel[node.level] = node.box.name;
          pathByLevel.length = node.level + 1;
          return {
            id: node.box.id,
            level: node.level,
            path_label: pathByLevel.join(' > ')
          };
        });
      }
    });
  }

  private loadTagsCloud(): void {
    if (!this.selectedWarehouseId) {
      return;
    }
    this.itemService.tagsCloud(this.selectedWarehouseId).subscribe({
      next: (tags) => {
        this.tagsCloud = tags;
      }
    });
  }

  private upsertItem(updated: Item): void {
    this.items = this.items.map((it) => (it.id === updated.id ? updated : it));
  }
}
