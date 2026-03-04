import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { BoxService } from '../services/box.service';
import { Item, ItemService, TagCloudEntry } from '../services/item.service';
import { SettingsService } from '../services/settings.service';
import { SyncService } from '../services/sync.service';
import { WarehouseService } from '../services/warehouse.service';

interface BoxMoveOption {
  id: string;
  level: number;
  path_label: string;
}

type HomeViewMode = 'cards' | 'list';

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
    MatButtonToggleModule,
    MatIconModule,
    MatCheckboxModule,
    MatChipsModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule
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

      <mat-card class="surface-card batch-card">
        <mat-card-content>
          <button type="button" class="batch-toggle" (click)="toggleBatchActions()" [attr.aria-expanded]="batchActionsExpanded">
            <div>
              <h2 class="card-title">Acciones por lote</h2>
              <p class="card-subtitle">
                {{ batchActionsExpanded ? 'Modo lote activo' : 'Pulsa para activar selección en artículos' }} ·
                Seleccionados: {{ selectedItemIds.size }}
              </p>
            </div>
            <mat-icon class="batch-toggle-icon" [class.batch-toggle-open]="batchActionsExpanded">expand_more</mat-icon>
          </button>

          <div class="form-row" *ngIf="batchActionsExpanded">
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

      <ng-container *ngIf="items.length > 0; else emptyItems">
        <section class="results-toolbar" aria-label="Preferencias de visualización de resultados">
          <div>
            <p class="results-title">Inventario</p>
            <p class="results-count">{{ items.length }} artículos</p>
          </div>
          <mat-button-toggle-group
            [ngModel]="viewMode"
            (ngModelChange)="setViewMode($event)"
            [ngModelOptions]="{ standalone: true }"
            aria-label="Vista de resultados"
            class="view-toggle"
          >
            <mat-button-toggle value="cards">
              <mat-icon>grid_view</mat-icon>
              Cards
            </mat-button-toggle>
            <mat-button-toggle value="list">
              <mat-icon>table_rows</mat-icon>
              Lista
            </mat-button-toggle>
          </mat-button-toggle-group>
        </section>

        <div class="cards-grid" *ngIf="viewMode === 'cards'; else listView">
          <article class="product-card" *ngFor="let item of items">
            <div class="product-card-main">
              <mat-checkbox
                *ngIf="batchActionsExpanded"
                class="item-select-checkbox"
                [checked]="selectedItemIds.has(item.id)"
                (change)="toggleSelected(item.id)"
              ></mat-checkbox>

              <div
                class="product-avatar"
                [class.product-avatar-clickable]="!!item.photo_url"
                [attr.aria-hidden]="item.photo_url ? null : true"
                [attr.role]="item.photo_url ? 'button' : null"
                [attr.tabindex]="item.photo_url ? 0 : null"
                (mouseenter)="onAvatarMouseEnter(item, $event)"
                (mouseleave)="onAvatarMouseLeave()"
                (click)="onAvatarClick(item, $event)"
                (keydown.enter)="onAvatarKey(item, $event)"
                (keydown.space)="onAvatarKey(item, $event)"
              >
                <img *ngIf="item.photo_url" [src]="item.photo_url" [alt]="'Foto de ' + item.name" loading="lazy" />
                <mat-icon *ngIf="!item.photo_url">inventory_2</mat-icon>
              </div>

              <div class="product-copy">
                <p class="product-title">{{ item.name }}</p>
                <p class="product-meta" [matTooltip]="item.description || 'Sin descripción'">{{ item.description || 'Sin descripción' }}</p>
                <p class="product-path" [class.product-path-inbound]="item.box_is_inbound">{{ item.box_path.join(' > ') }}</p>
              </div>
            </div>

            <div class="product-actions">
              <div class="product-stock-inline" matTooltip="Stock actual">
                <mat-icon>inventory_2</mat-icon>
                <span>{{ item.stock }}</span>
              </div>
              <span class="actions-spacer"></span>
              <button
                mat-icon-button
                class="compact-icon-action"
                (click)="toggleFavorite(item)"
                [attr.aria-label]="'Favorito ' + item.name"
                [matTooltip]="item.is_favorite ? 'Quitar favorito' : 'Marcar favorito'"
              >
                <mat-icon>{{ item.is_favorite ? 'star' : 'star_border' }}</mat-icon>
              </button>
              <button
                mat-icon-button
                color="primary"
                class="compact-icon-action"
                type="button"
                (click)="adjustStock(item, 1)"
                [attr.aria-label]="'Incrementar stock de ' + item.name"
                matTooltip="Incrementar stock"
              >
                <mat-icon>add</mat-icon>
              </button>
              <button
                mat-icon-button
                class="compact-icon-action"
                type="button"
                (click)="adjustStock(item, -1)"
                [attr.aria-label]="'Reducir stock de ' + item.name"
                matTooltip="Reducir stock"
              >
                <mat-icon>remove</mat-icon>
              </button>
              <button
                mat-icon-button
                class="compact-icon-action"
                type="button"
                [routerLink]="['/app/items', item.id]"
                [attr.aria-label]="'Editar ' + item.name"
                matTooltip="Editar"
              >
                <mat-icon>edit</mat-icon>
              </button>
              <button
                mat-icon-button
                type="button"
                class="compact-icon-action"
                (click)="reprocessItemTags(item)"
                [disabled]="reprocessingItemIds.has(item.id)"
                [attr.aria-label]="'Reprocesar tags de ' + item.name"
                [matTooltip]="reprocessingItemIds.has(item.id) ? 'Reprocesando tags' : 'Reprocesar tags'"
              >
                <mat-icon>{{ reprocessingItemIds.has(item.id) ? 'hourglass_top' : 'auto_awesome' }}</mat-icon>
              </button>
              <button
                mat-icon-button
                color="warn"
                type="button"
                class="compact-icon-action"
                (click)="deleteItem(item)"
                [attr.aria-label]="'Borrar ' + item.name"
                matTooltip="Borrar"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </article>
        </div>

        <ng-template #listView>
          <section class="table-shell">
            <div class="table-scroll">
              <table class="inventory-table" aria-label="Listado de artículos">
                <thead>
                  <tr>
                    <th class="col-select" *ngIf="batchActionsExpanded"></th>
                    <th class="col-item">Artículo</th>
                    <th class="col-route">Ruta</th>
                    <th class="col-stock">Stock</th>
                    <th class="col-tags">Tags</th>
                    <th class="col-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let item of items">
                    <td class="col-select" *ngIf="batchActionsExpanded">
                      <mat-checkbox
                        class="item-select-checkbox"
                        [checked]="selectedItemIds.has(item.id)"
                        (change)="toggleSelected(item.id)"
                      ></mat-checkbox>
                    </td>
                    <td class="col-item">
                      <div class="table-item-cell">
                        <div
                          class="product-avatar table-avatar"
                          [class.product-avatar-clickable]="!!item.photo_url"
                          [attr.aria-hidden]="item.photo_url ? null : true"
                          [attr.role]="item.photo_url ? 'button' : null"
                          [attr.tabindex]="item.photo_url ? 0 : null"
                          (mouseenter)="onAvatarMouseEnter(item, $event)"
                          (mouseleave)="onAvatarMouseLeave()"
                          (click)="onAvatarClick(item, $event)"
                          (keydown.enter)="onAvatarKey(item, $event)"
                          (keydown.space)="onAvatarKey(item, $event)"
                        >
                          <img *ngIf="item.photo_url" [src]="item.photo_url" [alt]="'Foto de ' + item.name" loading="lazy" />
                          <mat-icon *ngIf="!item.photo_url">inventory_2</mat-icon>
                        </div>
                        <div class="table-item-copy">
                          <p class="table-item-title">{{ item.name }}</p>
                          <p class="table-item-subtitle" [matTooltip]="item.description || 'Sin descripción'">{{ item.description || 'Sin descripción' }}</p>
                        </div>
                      </div>
                    </td>
                    <td class="col-route route-text" [class.route-text-inbound]="item.box_is_inbound">{{ item.box_path.join(' > ') }}</td>
                    <td class="col-stock">
                      <span class="product-stock">{{ item.stock }}</span>
                    </td>
                    <td class="col-tags">
                      <div class="table-tags">
                        <span class="table-tag" *ngFor="let tag of item.tags | slice:0:2">{{ tag }}</span>
                        <span class="table-tag-more" *ngIf="item.tags.length > 2">+{{ item.tags.length - 2 }}</span>
                      </div>
                    </td>
                    <td class="col-actions">
                      <div class="table-actions">
                        <button
                          mat-icon-button
                          class="compact-icon-action"
                          (click)="toggleFavorite(item)"
                          [attr.aria-label]="'Favorito ' + item.name"
                          [matTooltip]="item.is_favorite ? 'Quitar favorito' : 'Marcar favorito'"
                        >
                          <mat-icon>{{ item.is_favorite ? 'star' : 'star_border' }}</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          color="primary"
                          class="compact-icon-action"
                          type="button"
                          (click)="adjustStock(item, 1)"
                          [attr.aria-label]="'Incrementar stock de ' + item.name"
                          matTooltip="Incrementar stock"
                        >
                          <mat-icon>add</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          class="compact-icon-action"
                          type="button"
                          (click)="adjustStock(item, -1)"
                          [attr.aria-label]="'Reducir stock de ' + item.name"
                          matTooltip="Reducir stock"
                        >
                          <mat-icon>remove</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          type="button"
                          class="compact-icon-action"
                          [routerLink]="['/app/items', item.id]"
                          [attr.aria-label]="'Editar ' + item.name"
                          matTooltip="Editar"
                        >
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          type="button"
                          class="compact-icon-action"
                          (click)="reprocessItemTags(item)"
                          [disabled]="reprocessingItemIds.has(item.id)"
                          [attr.aria-label]="'Reprocesar tags de ' + item.name"
                          [matTooltip]="reprocessingItemIds.has(item.id) ? 'Reprocesando tags' : 'Reprocesar tags'"
                        >
                          <mat-icon>{{ reprocessingItemIds.has(item.id) ? 'hourglass_top' : 'auto_awesome' }}</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          color="warn"
                          type="button"
                          class="compact-icon-action"
                          (click)="deleteItem(item)"
                          [attr.aria-label]="'Borrar ' + item.name"
                          matTooltip="Borrar"
                        >
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </ng-template>
      </ng-container>

      <ng-template #emptyItems>
        <div class="empty-state" style="margin-top: 14px">
          No hay artículos para los filtros seleccionados.
        </div>
      </ng-template>

      <div
        class="avatar-preview-backdrop"
        *ngIf="avatarPreviewUrl && avatarPreviewPinned"
        (click)="closeAvatarPreview(true)"
      ></div>
      <aside
        class="avatar-preview-panel"
        *ngIf="avatarPreviewUrl"
        [ngStyle]="avatarPreviewStyle"
        [class.avatar-preview-pinned]="avatarPreviewPinned"
        (mouseenter)="onPreviewMouseEnter()"
        (mouseleave)="onPreviewMouseLeave()"
        (click)="$event.stopPropagation()"
      >
        <img [src]="avatarPreviewUrl" [alt]="'Vista ampliada de ' + avatarPreviewName" />
        <p>{{ avatarPreviewName }}</p>
      </aside>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .results-toolbar {
        margin-top: 16px;
        padding: 10px 2px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .results-title {
        margin: 0;
        font-size: 0.93rem;
        font-weight: 600;
        color: var(--text-1);
      }

      .results-count {
        margin: 2px 0 0;
        color: var(--text-2);
        font-size: 0.83rem;
      }

      .view-toggle {
        border-radius: 10px;
      }

      .view-toggle mat-button-toggle {
        font-size: 0.84rem;
      }

      .batch-card {
        margin-top: 12px;
      }

      .batch-toggle {
        width: 100%;
        border: none;
        background: transparent;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        text-align: left;
        cursor: pointer;
      }

      .batch-toggle-icon {
        transition: transform 120ms ease;
      }

      .batch-toggle-open {
        transform: rotate(180deg);
      }

      .cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 10px;
      }

      .product-card {
        border: 1px solid rgba(219, 227, 239, 0.9);
        border-radius: 12px;
        background: linear-gradient(180deg, #f8f9fc 0%, #f3f6fb 100%);
        padding: 8px;
        display: grid;
        gap: 8px;
      }

      .product-card-main {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      .product-avatar {
        width: 36px;
        height: 36px;
        border-radius: 9px;
        border: 1px solid var(--border-soft);
        background: #fff;
        overflow: hidden;
        flex: 0 0 36px;
        display: grid;
        place-items: center;
      }

      .product-avatar-clickable {
        cursor: zoom-in;
      }

      .product-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .product-avatar .mat-icon {
        width: 17px;
        height: 17px;
        font-size: 17px;
        color: var(--text-2);
      }

      .product-copy {
        min-width: 0;
        flex: 1 1 auto;
        display: grid;
        gap: 1px;
      }

      .product-title {
        margin: 0;
        font-size: 0.88rem;
        font-weight: 600;
        color: #1f2937;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .product-meta,
      .product-path {
        margin: 0;
        font-size: 0.78rem;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .product-path-inbound {
        color: #b91c1c;
        font-weight: 600;
      }

      .product-stock {
        display: inline-flex;
        align-self: flex-start;
        margin-top: 2px;
        font-size: 0.74rem;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 999px;
        background: #deecff;
        color: #1f4db8;
        border: 1px solid #bfd8ff;
        white-space: nowrap;
      }

      .product-actions {
        border-top: 1px solid rgba(219, 227, 239, 0.85);
        padding-top: 7px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
      }

      .product-stock-inline {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        border-radius: 999px;
        border: 1px solid rgba(191, 216, 255, 0.8);
        background: #edf4ff;
        color: #234e9c;
        font-size: 0.76rem;
        font-weight: 600;
      }

      .product-stock-inline .mat-icon {
        width: 14px;
        height: 14px;
        font-size: 14px;
      }

      .actions-spacer {
        flex: 1 1 auto;
      }

      .table-shell {
        border: 1px solid var(--border-soft);
        border-radius: 14px;
        background: linear-gradient(180deg, #fcfdff 0%, #f6f8fc 100%);
        overflow: hidden;
      }

      .table-scroll {
        overflow-x: auto;
      }

      .inventory-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 1040px;
      }

      .inventory-table th {
        text-align: left;
        font-size: 0.73rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: #64748b;
        text-transform: uppercase;
        padding: 11px 10px;
        border-bottom: 1px solid var(--border-soft);
        background: #f2f6fd;
        white-space: nowrap;
      }

      .inventory-table td {
        padding: 8px 10px;
        border-bottom: 1px solid rgba(219, 227, 239, 0.72);
        vertical-align: middle;
      }

      .inventory-table tbody tr:last-child td {
        border-bottom: none;
      }

      .col-select {
        width: 44px;
      }

      .col-stock {
        width: 90px;
      }

      .col-tags {
        width: 180px;
      }

      .col-actions {
        width: 310px;
      }

      .table-item-cell {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
      }

      .table-avatar {
        width: 32px;
        height: 32px;
        flex-basis: 32px;
      }

      .table-item-copy {
        min-width: 0;
      }

      .table-item-title,
      .table-item-subtitle {
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .table-item-title {
        font-size: 0.9rem;
        font-weight: 600;
        color: #1f2937;
      }

      .table-item-subtitle {
        margin-top: 1px;
        font-size: 0.77rem;
        color: #64748b;
      }

      .route-text {
        font-size: 0.81rem;
        color: #475569;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 0;
      }

      .route-text-inbound {
        color: #b91c1c;
        font-weight: 600;
      }

      .table-tags {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
      }

      .table-tag {
        font-size: 0.72rem;
        border: 1px solid var(--border-soft);
        color: #475569;
        background: #eef3fa;
        border-radius: 999px;
        padding: 2px 7px;
      }

      .table-tag-more {
        font-size: 0.72rem;
        color: #64748b;
      }

      .table-actions {
        display: flex;
        align-items: center;
        gap: 3px;
        flex-wrap: wrap;
      }

      .compact-icon-action {
        width: 29px !important;
        height: 29px !important;
        padding: 2px !important;
      }

      .avatar-preview-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(14, 23, 38, 0.18);
        z-index: 1200;
      }

      .avatar-preview-panel {
        position: fixed;
        width: 260px;
        max-width: calc(100vw - 18px);
        background: #ffffff;
        border: 1px solid rgba(191, 201, 219, 0.9);
        border-radius: 12px;
        padding: 8px;
        box-shadow: 0 16px 34px rgba(15, 23, 42, 0.18);
        z-index: 1201;
      }

      .avatar-preview-panel img {
        display: block;
        width: 100%;
        height: auto;
        max-height: min(52vh, 320px);
        object-fit: contain;
        border-radius: 8px;
        background: #f4f7fb;
      }

      .avatar-preview-panel p {
        margin: 7px 2px 2px;
        font-size: 0.78rem;
        font-weight: 600;
        color: #2d3a4d;
        line-height: 1.3;
      }

      @media (max-width: 900px) {
        .cards-grid {
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        }

        .table-shell {
          border-radius: 12px;
        }
      }

      @media (max-width: 640px) {
        .cards-grid {
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .product-card {
          padding: 7px;
        }

        .product-actions {
          gap: 3px;
        }

        .avatar-preview-panel {
          width: calc(100vw - 18px);
          max-width: 360px;
        }
      }
    `
  ]
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();
  private readonly destroy$ = new Subject<void>();
  private readonly viewModeStorageKey = 'home_view_mode';

  errorMessage = '';
  loadingItems = false;
  items: Item[] = [];
  boxes: BoxMoveOption[] = [];
  tagsCloud: TagCloudEntry[] = [];
  activeTag: string | null = null;
  targetBoxId: string | null = null;
  reprocessingItemIds = new Set<string>();
  selectedItemIds = new Set<string>();
  batchActionsExpanded = false;
  viewMode: HomeViewMode = 'cards';
  avatarPreviewUrl: string | null = null;
  avatarPreviewName = '';
  avatarPreviewPinned = false;
  avatarPreviewStyle: Record<string, string> = {};
  private avatarPreviewHovering = false;

  readonly filtersForm = this.fb.nonNullable.group({
    q: [''],
    favoritesOnly: false,
    stockZero: false
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly itemService: ItemService,
    private readonly boxService: BoxService,
    private readonly settingsService: SettingsService,
    private readonly syncService: SyncService,
    private readonly warehouseService: WarehouseService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (!this.selectedWarehouseId) {
      this.router.navigateByUrl('/warehouses');
      return;
    }

    this.viewMode = this.readStoredViewMode();
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

  @HostListener('window:keydown.escape')
  onEscClosePreview(): void {
    this.closeAvatarPreview(true);
  }

  onAvatarMouseEnter(item: Item, event: MouseEvent): void {
    if (!item.photo_url || this.avatarPreviewPinned || isCoarsePointerDevice()) {
      return;
    }
    this.openAvatarPreview(item, event, false);
  }

  onAvatarMouseLeave(): void {
    if (this.avatarPreviewPinned) {
      return;
    }
    setTimeout(() => {
      if (!this.avatarPreviewHovering && !this.avatarPreviewPinned) {
        this.closeAvatarPreview(false);
      }
    }, 70);
  }

  onAvatarClick(item: Item, event: MouseEvent): void {
    if (!item.photo_url) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (this.avatarPreviewPinned && this.avatarPreviewUrl === item.photo_url) {
      this.closeAvatarPreview(true);
      return;
    }
    this.openAvatarPreview(item, event, true);
  }

  onAvatarKey(item: Item, event: KeyboardEvent): void {
    if (!item.photo_url) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (this.avatarPreviewPinned && this.avatarPreviewUrl === item.photo_url) {
      this.closeAvatarPreview(true);
      return;
    }
    const target = event.currentTarget as HTMLElement | null;
    this.openAvatarPreview(item, { currentTarget: target } as MouseEvent, true);
  }

  onPreviewMouseEnter(): void {
    this.avatarPreviewHovering = true;
  }

  onPreviewMouseLeave(): void {
    this.avatarPreviewHovering = false;
    if (!this.avatarPreviewPinned) {
      this.closeAvatarPreview(false);
    }
  }

  closeAvatarPreview(force: boolean): void {
    if (!force && this.avatarPreviewPinned) {
      return;
    }
    this.avatarPreviewUrl = null;
    this.avatarPreviewName = '';
    this.avatarPreviewPinned = false;
    this.avatarPreviewStyle = {};
    this.avatarPreviewHovering = false;
  }

  setViewMode(mode: string): void {
    if (mode !== 'cards' && mode !== 'list') {
      return;
    }
    this.viewMode = mode;
    localStorage.setItem(this.viewModeStorageKey, mode);
  }

  toggleBatchActions(): void {
    this.batchActionsExpanded = !this.batchActionsExpanded;
    if (!this.batchActionsExpanded) {
      this.selectedItemIds.clear();
      this.targetBoxId = null;
    }
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
          payload: {}
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
          payload: { delta }
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

  reprocessItemTags(item: Item): void {
    if (!this.selectedWarehouseId || this.reprocessingItemIds.has(item.id)) {
      return;
    }

    this.reprocessingItemIds.add(item.id);
    this.settingsService.reprocessItem(this.selectedWarehouseId, item.id, ['tags']).subscribe({
      next: (res) => {
        this.reprocessingItemIds.delete(item.id);
        this.upsertItem({ ...item, tags: res.tags });
        this.loadTagsCloud();
      },
      error: () => {
        this.reprocessingItemIds.delete(item.id);
        this.errorMessage = 'No se pudieron reprocesar los tags del artículo.';
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

  private readStoredViewMode(): HomeViewMode {
    const saved = localStorage.getItem(this.viewModeStorageKey);
    if (saved === 'cards' || saved === 'list') {
      return saved;
    }
    return 'cards';
  }

  private openAvatarPreview(item: Item, event: MouseEvent, pinned: boolean): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target || !item.photo_url) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const panelWidth = Math.min(260, window.innerWidth - 18);
    const panelHeight = Math.min(350, Math.floor(window.innerHeight * 0.6));
    const margin = 10;
    const placeRight = rect.right + margin + panelWidth <= window.innerWidth - margin;
    let left = placeRight ? rect.right + margin : rect.left - panelWidth - margin;
    left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));
    let top = rect.top - 14;
    top = Math.max(margin, Math.min(top, window.innerHeight - panelHeight - margin));

    this.avatarPreviewUrl = item.photo_url;
    this.avatarPreviewName = item.name;
    this.avatarPreviewPinned = pinned;
    this.avatarPreviewHovering = false;
    this.avatarPreviewStyle = {
      left: `${left}px`,
      top: `${top}px`
    };
  }
}

function isCoarsePointerDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches;
}
