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
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { Box, BoxService } from '../services/box.service';
import { Item, ItemService, TagCloudEntry } from '../services/item.service';
import { WarehouseService } from '../services/warehouse.service';

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
    MatListModule
  ],
  template: `
    <div class="page-wide">
      <mat-card>
        <mat-card-title>Home</mat-card-title>
        <mat-card-content>
          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
          <form [formGroup]="filtersForm" class="row gap" (ngSubmit)="loadItems()">
            <mat-form-field class="grow">
              <mat-label>Buscar</mat-label>
              <input matInput formControlName="q" placeholder="nombre, tags, alias, ubicación" />
            </mat-form-field>
            <mat-checkbox formControlName="favoritesOnly">Favoritos</mat-checkbox>
            <mat-checkbox formControlName="stockZero">Stock = 0</mat-checkbox>
            <button mat-flat-button color="primary">Buscar</button>
            <button mat-stroked-button type="button" (click)="clearFilters()">Limpiar</button>
          </form>

          <div class="row gap center-y" style="margin: 8px 0 12px" *ngIf="tagsCloud.length > 0">
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

          <div class="row gap" style="margin: 12px 0">
            <mat-form-field>
              <mat-label>Mover seleccionados a caja</mat-label>
              <mat-select [(ngModel)]="targetBoxId" [ngModelOptions]="{ standalone: true }">
                <mat-option *ngFor="let box of boxes" [value]="box.id">{{ box.name }}</mat-option>
              </mat-select>
            </mat-form-field>
            <button mat-stroked-button (click)="batchMove()" [disabled]="selectedItemIds.size === 0 || !targetBoxId">
              Mover lote
            </button>
            <button mat-stroked-button (click)="batchFavorite(true)" [disabled]="selectedItemIds.size === 0">
              Favorito lote
            </button>
            <button mat-stroked-button (click)="batchFavorite(false)" [disabled]="selectedItemIds.size === 0">
              Quitar favorito lote
            </button>
            <button mat-flat-button color="warn" (click)="batchDelete()" [disabled]="selectedItemIds.size === 0">
              Borrar lote
            </button>
            <button mat-flat-button color="primary" [routerLink]="['/app/items/new']">Nuevo artículo</button>
          </div>

          <mat-list>
            <mat-list-item *ngFor="let item of items" class="item-row">
              <mat-checkbox [checked]="selectedItemIds.has(item.id)" (change)="toggleSelected(item.id)"></mat-checkbox>
              <div class="grow" style="margin-left: 10px">
                <div class="row gap center-y">
                  <strong>{{ item.name }}</strong>
                  <span class="muted">{{ item.box_path.join(' > ') }}</span>
                  <span class="muted">Stock: {{ item.stock }}</span>
                </div>
                <div class="muted">{{ item.description || 'Sin descripción' }}</div>
              </div>
              <button mat-icon-button (click)="toggleFavorite(item)" [attr.aria-label]="'Favorito ' + item.name">
                <mat-icon>{{ item.is_favorite ? 'star' : 'star_border' }}</mat-icon>
              </button>
              <button mat-mini-fab color="primary" (click)="adjustStock(item, 1)">+</button>
              <button mat-mini-fab color="basic" (click)="adjustStock(item, -1)">-</button>
              <button mat-button [routerLink]="['/app/items', item.id]">Editar</button>
              <button mat-button color="warn" (click)="deleteItem(item)">Borrar</button>
            </mat-list-item>
          </mat-list>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();
  private readonly destroy$ = new Subject<void>();

  errorMessage = '';
  items: Item[] = [];
  boxes: Box[] = [];
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
    this.itemService
      .list(this.selectedWarehouseId, {
        q: raw.q,
        tag: this.activeTag || undefined,
        favoritesOnly: raw.favoritesOnly,
        stockZero: raw.stockZero
      })
      .subscribe({
        next: (items) => {
          this.items = items;
          this.selectedItemIds.clear();
        },
        error: () => {
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

    this.itemService.setFavorite(this.selectedWarehouseId, item.id, !item.is_favorite).subscribe({
      next: (updated) => {
        this.upsertItem(updated);
      },
      error: () => {
        this.errorMessage = 'No se pudo actualizar favorito.';
      }
    });
  }

  adjustStock(item: Item, delta: 1 | -1): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    this.itemService
      .adjustStock(this.selectedWarehouseId, item.id, delta, crypto.randomUUID())
      .subscribe({
        next: (updated) => {
          this.upsertItem(updated);
        },
        error: () => {
          this.errorMessage = 'No se pudo ajustar stock.';
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
        this.boxes = nodes.map((n) => n.box);
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar las cajas.';
      }
    });
  }

  private loadTagsCloud(): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    this.itemService.tagsCloud(this.selectedWarehouseId).subscribe({
      next: (cloud) => {
        this.tagsCloud = cloud;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar la nube de tags.';
      }
    });
  }

  private upsertItem(item: Item): void {
    const idx = this.items.findIndex((it) => it.id === item.id);
    if (idx === -1) {
      this.items = [item, ...this.items];
      return;
    }
    this.items[idx] = item;
    this.items = [...this.items];
  }
}
