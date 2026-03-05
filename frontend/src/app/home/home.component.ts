import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { BoxService } from '../services/box.service';
import { generateUuid } from '../core/uuid';
import { ItemCardComponent } from '../items/item-card.component';
import { ItemListComponent } from '../items/item-list.component';
import { Item, ItemService, TagCloudEntry } from '../services/item.service';
import { NotificationService } from '../services/notification.service';
import { SettingsService } from '../services/settings.service';
import { SyncService } from '../services/sync.service';
import { WarehouseService } from '../services/warehouse.service';

interface BoxMoveOption {
  id: string;
  level: number;
  path_label: string;
}

interface TagCloudVisualEntry extends TagCloudEntry {
  styleVars: Record<string, string>;
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
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule,
    ItemCardComponent,
    ItemListComponent
  ],
  template: `
    <div class="app-page home-page">
      <header class="page-header home-header">
        <div>
          <h1 class="page-title">Inicio</h1>
          <p class="page-subtitle">Consulta rápida de artículos, favoritos y stock por warehouse</p>
        </div>
        <button
          mat-mini-fab
          color="primary"
          class="home-primary-action"
          [routerLink]="['/app/items/new']"
          matTooltip="Nuevo elemento"
          aria-label="Nuevo elemento"
        >
          <mat-icon>add</mat-icon>
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

          <div
            [formGroup]="filtersForm"
            class="home-filters-layout"
            [class.home-filters-layout-no-tags]="visualTagsCloud.length === 0"
          >
            <section class="home-filters-left" aria-label="Búsqueda y filtros rápidos">
              <mat-form-field class="grow">
                <mat-label>Buscar artículo</mat-label>
                <mat-icon matPrefix>search</mat-icon>
                <input matInput formControlName="q" placeholder="nombre, tags, alias, ubicación" />
              </mat-form-field>

              <div class="quick-filter-pills" role="group" aria-label="Filtros rápidos">
                <button
                  type="button"
                  class="quick-filter-pill"
                  [class.quick-filter-pill-active]="filtersForm.controls.favoritesOnly.value"
                  [attr.aria-pressed]="filtersForm.controls.favoritesOnly.value"
                  (click)="toggleQuickFilter('favoritesOnly')"
                >
                  <mat-icon>{{ filtersForm.controls.favoritesOnly.value ? 'star' : 'star_outline' }}</mat-icon>
                  Solo favoritos
                </button>
                <button
                  type="button"
                  class="quick-filter-pill"
                  [class.quick-filter-pill-active]="filtersForm.controls.stockZero.value"
                  [attr.aria-pressed]="filtersForm.controls.stockZero.value"
                  (click)="toggleQuickFilter('stockZero')"
                >
                  <mat-icon>{{ filtersForm.controls.stockZero.value ? 'report_off' : 'remove_shopping_cart' }}</mat-icon>
                  Stock = 0
                </button>
              </div>
            </section>

            <section class="home-filters-right" *ngIf="visualTagsCloud.length > 0">
              <div class="home-tags-head">
                <span class="muted">Nube de tags</span>
                <button mat-button type="button" *ngIf="activeTag" (click)="toggleTag(activeTag)">Quitar tag</button>
              </div>
              <div class="home-tags-cloud" role="list" aria-label="Nube de tags para filtrar artículos">
                <button
                  type="button"
                  class="home-tag-chip"
                  role="listitem"
                  *ngFor="let tag of visualTagsCloud; trackBy: trackTagCloud"
                  [ngStyle]="tag.styleVars"
                  [class.home-tag-chip-active]="activeTag === tag.tag"
                  [attr.aria-pressed]="activeTag === tag.tag"
                  [attr.aria-label]="'Filtrar por tag ' + tag.tag + ' con ' + tag.count + ' artículos'"
                  (click)="toggleTag(tag.tag)"
                >
                  <span class="home-tag-chip-label">{{ tag.tag }}</span>
                  <span class="home-tag-chip-count">{{ tag.count }}</span>
                </button>
              </div>
            </section>
          </div>
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
            *ngIf="!isMobileView"
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

        <div class="cards-grid" *ngIf="effectiveViewMode === 'cards'; else listView">
          <app-item-card
            *ngFor="let item of items"
            [item]="item"
            [showSelection]="batchActionsExpanded"
            [isSelected]="selectedItemIds.has(item.id)"
            [isMobileView]="isMobileView"
            [isReprocessing]="reprocessingItemIds.has(item.id)"
            [enablePhotoPreview]="true"
            (selectionToggle)="toggleSelected(item.id)"
            (favoriteToggle)="toggleFavorite(item)"
            (stockAdjust)="adjustStock(item, $event)"
            (reprocess)="reprocessItemTags(item)"
            (deleteItem)="deleteItem(item)"
            (avatarMouseEnter)="onAvatarMouseEnter(item, $event)"
            (avatarMouseLeave)="onAvatarMouseLeave()"
            (avatarClick)="onAvatarClick(item, $event)"
            (avatarKey)="onAvatarKey(item, $event)"
          ></app-item-card>
        </div>

        <ng-template #listView>
          <app-item-list
            [items]="items"
            [showSelection]="batchActionsExpanded"
            [selectedItemIds]="selectedItemIds"
            [reprocessingItemIds]="reprocessingItemIds"
            [enablePhotoPreview]="true"
            (selectionToggle)="toggleSelected($event)"
            (favoriteToggle)="toggleFavorite($event)"
            (stockAdjust)="adjustStock($event.item, $event.delta)"
            (reprocess)="reprocessItemTags($event)"
            (deleteItem)="deleteItem($event)"
            (avatarMouseEnter)="onAvatarMouseEnter($event.item, $event.event)"
            (avatarMouseLeave)="onAvatarMouseLeave()"
            (avatarClick)="onAvatarClick($event.item, $event.event)"
            (avatarKey)="onAvatarKey($event.item, $event.event)"
          ></app-item-list>
        </ng-template>
      </ng-container>

      <ng-template #emptyItems>
        <div class="empty-state mt-14">
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
        [class.avatar-preview-modal]="avatarPreviewModal"
        (mouseenter)="onPreviewMouseEnter()"
        (mouseleave)="onPreviewMouseLeave()"
        (click)="$event.stopPropagation()"
      >
        <img [src]="avatarPreviewUrl" [alt]="'Vista ampliada de ' + avatarPreviewName" />
        <div class="avatar-preview-modal-actions" *ngIf="avatarPreviewModal">
          <button
            mat-flat-button
            color="primary"
            type="button"
            class="avatar-preview-close-large"
            aria-label="Cerrar vista ampliada"
            (click)="closeAvatarPreview(true)"
          >
            Cerrar
          </button>
        </div>
      </aside>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .home-header {
        align-items: flex-start;
      }

      .home-primary-action {
        flex-shrink: 0;
      }

      .home-filters-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
        gap: 16px;
        align-items: start;
      }

      .home-filters-layout-no-tags {
        grid-template-columns: 1fr;
      }

      .home-filters-left,
      .home-filters-right {
        min-width: 0;
        display: grid;
        gap: 10px;
      }

      .home-filters-right {
        border-left: 1px solid rgba(211, 222, 236, 0.88);
        padding-left: 14px;
      }

      .quick-filter-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .quick-filter-pill {
        border: 1px solid rgba(188, 202, 224, 0.96);
        border-radius: 999px;
        background: #f7f9fd;
        color: #344054;
        padding: 7px 12px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: border-color 120ms ease, background-color 120ms ease, box-shadow 120ms ease, color 120ms ease;
      }

      .quick-filter-pill:hover {
        border-color: rgba(140, 169, 212, 0.96);
        background: #f1f6ff;
      }

      .quick-filter-pill:focus-visible {
        outline: 2px solid rgba(39, 93, 198, 0.42);
        outline-offset: 1px;
      }

      .quick-filter-pill .mat-icon {
        width: 15px;
        height: 15px;
        font-size: 15px;
      }

      .quick-filter-pill-active {
        border-color: rgba(37, 74, 166, 0.94);
        background: linear-gradient(180deg, #2f58c5 0%, #2748a4 100%);
        color: #f7faff;
        box-shadow: 0 6px 14px rgba(39, 72, 164, 0.25);
      }

      .quick-filter-pill.quick-filter-pill-active:hover,
      .quick-filter-pill.quick-filter-pill-active:active,
      .quick-filter-pill.quick-filter-pill-active:focus-visible {
        border-color: rgba(37, 74, 166, 0.94);
        background: linear-gradient(180deg, #2f58c5 0%, #2748a4 100%);
        color: #f7faff;
      }

      .home-tags-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .home-tags-cloud {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        align-items: center;
        gap: 8px;
        max-height: 232px;
        overflow: hidden;
      }

      .home-tag-chip {
        --tag-hue: 205;
        --tag-saturation: 56%;
        --tag-lightness: 91%;
        --tag-font-size: 0.78rem;
        --tag-font-weight: 560;
        --tag-border-alpha: 0.24;
        --tag-shadow-alpha: 0.12;
        border: 1px solid hsl(var(--tag-hue) 42% 40% / var(--tag-border-alpha));
        border-radius: 999px;
        background: linear-gradient(
          180deg,
          hsl(var(--tag-hue) var(--tag-saturation) calc(var(--tag-lightness) + 3%)) 0%,
          hsl(var(--tag-hue) var(--tag-saturation) var(--tag-lightness)) 100%
        );
        color: hsl(var(--tag-hue) 48% 22%);
        padding: 5px 9px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: var(--tag-font-size);
        font-weight: var(--tag-font-weight);
        letter-spacing: 0.01em;
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
      }

      .home-tag-chip:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 16px rgba(15, 23, 42, var(--tag-shadow-alpha));
      }

      .home-tag-chip:focus-visible {
        outline: 2px solid rgba(39, 93, 198, 0.45);
        outline-offset: 1px;
      }

      .home-tag-chip-active {
        border-color: #1e3f94;
        background: linear-gradient(180deg, #2f58c5 0%, #2748a4 100%);
        color: #f8fbff;
        box-shadow: 0 8px 18px rgba(39, 72, 164, 0.34);
      }

      .home-tag-chip-label {
        line-height: 1;
      }

      .home-tag-chip-count {
        min-width: 1.6em;
        border-radius: 999px;
        padding: 1px 6px;
        text-align: center;
        font-size: 0.75em;
        line-height: 1.2;
        background: rgba(255, 255, 255, 0.58);
      }

      .home-tag-chip-active .home-tag-chip-count {
        background: rgba(255, 255, 255, 0.22);
        color: #f3f7ff;
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

      .product-actions-mobile {
        flex-wrap: nowrap;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scrollbar-width: thin;
        padding-bottom: 2px;
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
        width: 32px !important;
        height: 32px !important;
        padding: 4px !important;
      }

      .avatar-preview-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(14, 23, 38, 0.18);
        z-index: 1200;
      }

      .avatar-preview-panel {
        position: fixed;
        background: #ffffff;
        border: 1px solid rgba(191, 201, 219, 0.9);
        border-radius: 14px;
        padding: 10px;
        box-shadow: 0 18px 38px rgba(15, 23, 42, 0.22);
        z-index: 1201;
        display: flex;
        flex-direction: column;
      }

      .avatar-preview-panel img {
        display: block;
        width: 100%;
        height: auto;
        flex: 1 1 auto;
        min-height: 0;
        object-fit: contain;
        border-radius: 10px;
        background: #f4f7fb;
      }

      .avatar-preview-modal-actions {
        margin-top: 12px;
        display: flex;
      }

      .avatar-preview-close-large {
        width: 100%;
        min-height: 46px;
        border-radius: 10px;
        font-weight: 600;
      }

      .avatar-preview-modal {
        left: 50% !important;
        top: 50% !important;
        transform: translate(-50%, -50%);
        width: min(92vw, 960px) !important;
        height: min(88vh, 900px) !important;
        max-width: calc(100vw - 24px);
        max-height: calc(100vh - 24px);
        padding: 12px;
      }

      @media (max-width: 900px) {
        .cards-grid {
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        }

        .table-shell {
          border-radius: 12px;
        }

        .home-filters-layout {
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .home-filters-right {
          border-left: none;
          border-top: 1px solid rgba(211, 222, 236, 0.88);
          padding-left: 0;
          padding-top: 9px;
        }
      }

      @media (max-width: 640px) {
        .home-header {
          gap: 10px;
        }

        .home-header > button.home-primary-action {
          width: 40px !important;
          min-width: 40px !important;
          height: 40px !important;
        }

        .quick-filter-pills {
          width: 100%;
          gap: 7px;
        }

        .home-tags-cloud {
          max-height: 184px;
        }

        .home-tag-chip {
          padding: 6px 10px;
        }

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

        .product-actions .actions-spacer {
          display: none;
        }

        .compact-icon-action {
          width: 40px !important;
          height: 40px !important;
          padding: 8px !important;
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
  visualTagsCloud: TagCloudVisualEntry[] = [];
  activeTag: string | null = null;
  targetBoxId: string | null = null;
  reprocessingItemIds = new Set<string>();
  selectedItemIds = new Set<string>();
  batchActionsExpanded = false;
  viewMode: HomeViewMode = 'cards';
  isMobileView = isNarrowViewport();
  avatarPreviewUrl: string | null = null;
  avatarPreviewName = '';
  avatarPreviewPinned = false;
  avatarPreviewModal = false;
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
    private readonly router: Router,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (!this.selectedWarehouseId) {
      this.router.navigateByUrl('/warehouses');
      return;
    }

    this.viewMode = this.readStoredViewMode();
    this.syncViewportState();
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

  @HostListener('window:resize')
  onViewportResize(): void {
    this.syncViewportState();
  }

  onAvatarMouseEnter(item: Item, event: MouseEvent): void {
    if (!item.photo_url || this.avatarPreviewPinned || isTabletOrMobileViewport() || isCoarsePointerDevice()) {
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
    this.avatarPreviewModal = false;
    this.avatarPreviewStyle = {};
    this.avatarPreviewHovering = false;
  }

  setViewMode(mode: string): void {
    if (mode !== 'cards' && mode !== 'list') {
      return;
    }
    if (this.isMobileView && mode === 'list') {
      return;
    }
    this.viewMode = mode;
    localStorage.setItem(this.viewModeStorageKey, mode);
  }

  get effectiveViewMode(): HomeViewMode {
    return this.isMobileView ? 'cards' : this.viewMode;
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

  toggleTag(tag: string): void {
    this.activeTag = this.activeTag === tag ? null : tag;
    this.loadItems();
  }

  toggleQuickFilter(controlName: 'favoritesOnly' | 'stockZero'): void {
    const control = this.filtersForm.controls[controlName];
    control.setValue(!control.value);
  }

  trackTagCloud(_index: number, entry: TagCloudVisualEntry): string {
    return entry.tag;
  }

  toggleFavorite(item: Item): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    const nextFavorite = !item.is_favorite;
    const commandId = generateUuid();
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
        this.setActionInfo('Sin conexión: favorito en cola para sincronizar.');
      }
    });
  }

  adjustStock(item: Item, delta: 1 | -1): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    const commandId = generateUuid();
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
        this.setActionInfo('Sin conexión: ajuste de stock en cola para sincronizar.');
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
        this.notificationService.success('Artículo enviado a papelera.');
      },
      error: () => {
        this.setActionError('No se pudo borrar el artículo.');
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
        this.notificationService.success('Tags reprocesados.');
      },
      error: () => {
        this.reprocessingItemIds.delete(item.id);
        this.setActionError('No se pudieron reprocesar los tags del artículo.');
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
        next: () => {
          this.loadItems();
          this.notificationService.success('Lote movido correctamente.');
        },
        error: () => {
          this.setActionError('No se pudo mover el lote.');
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
        next: () => {
          this.loadItems();
          this.notificationService.success('Favoritos del lote actualizados.');
        },
        error: () => {
          this.setActionError('No se pudo actualizar favoritos en lote.');
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
        next: () => {
          this.loadItems();
          this.notificationService.success('Lote enviado a papelera.');
        },
        error: () => {
          this.setActionError('No se pudo borrar el lote.');
        }
      });
  }

  private setActionError(message: string): void {
    this.errorMessage = message;
    this.notificationService.error(message);
  }

  private setActionInfo(message: string): void {
    this.errorMessage = message;
    this.notificationService.info(message);
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
        this.visualTagsCloud = this.buildTagCloudVisuals(tags);
      }
    });
  }

  private buildTagCloudVisuals(tags: TagCloudEntry[]): TagCloudVisualEntry[] {
    if (!tags.length) {
      return [];
    }

    const counts = tags.map((tag) => tag.count);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    const range = Math.max(1, maxCount - minCount);

    return tags.map((tag) => {
      const weight = (tag.count - minCount) / range;
      const hue = this.pickTagHue(tag.tag);
      const saturation = 50 + Math.round(weight * 14);
      const lightness = 93 - Math.round(weight * 15);
      const fontSize = 0.76 + weight * 0.34;
      const fontWeight = 520 + Math.round(weight * 160);

      return {
        ...tag,
        styleVars: {
          '--tag-hue': `${hue}`,
          '--tag-saturation': `${saturation}%`,
          '--tag-lightness': `${lightness}%`,
          '--tag-font-size': `${fontSize.toFixed(2)}rem`,
          '--tag-font-weight': `${fontWeight}`,
          '--tag-border-alpha': (0.22 + weight * 0.22).toFixed(2),
          '--tag-shadow-alpha': (0.09 + weight * 0.14).toFixed(2)
        }
      };
    });
  }

  private pickTagHue(tag: string): number {
    const palette = [206, 188, 162, 144, 124, 98, 74, 36, 18];
    let hash = 0;
    for (let index = 0; index < tag.length; index += 1) {
      hash = (hash * 31 + tag.charCodeAt(index)) | 0;
    }
    return palette[Math.abs(hash) % palette.length];
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

  private syncViewportState(): void {
    this.isMobileView = isNarrowViewport();
  }

  private openAvatarPreview(item: Item, event: MouseEvent, pinned: boolean): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target || !item.photo_url) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const margin = 10;

    if (isTabletOrMobileViewport() || this.isMobileView || isCoarsePointerDevice()) {
      this.avatarPreviewUrl = item.photo_url;
      this.avatarPreviewName = item.name;
      this.avatarPreviewPinned = true;
      this.avatarPreviewModal = true;
      this.avatarPreviewHovering = false;
      this.avatarPreviewStyle = {};
      return;
    }

    const previewSize = Math.max(360, Math.round((rect.width || 36) * 20));
    const panelWidth = Math.min(previewSize, window.innerWidth - margin * 2);
    const panelHeight = Math.min(previewSize, window.innerHeight - margin * 2);
    const placeRight = rect.right + margin + panelWidth <= window.innerWidth - margin;
    let left = placeRight ? rect.right + margin : rect.left - panelWidth - margin;
    left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));
    let top = rect.top + rect.height / 2 - panelHeight / 2;
    top = Math.max(margin, Math.min(top, window.innerHeight - panelHeight - margin));

    this.avatarPreviewUrl = item.photo_url;
    this.avatarPreviewName = item.name;
    this.avatarPreviewPinned = pinned;
    this.avatarPreviewModal = false;
    this.avatarPreviewHovering = false;
    this.avatarPreviewStyle = {
      width: `${panelWidth}px`,
      height: `${panelHeight}px`,
      left: `${left}px`,
      top: `${top}px`
    };
  }
}

function isCoarsePointerDevice(): boolean {
  return mediaQueryMatches('(hover: none), (pointer: coarse)');
}

function isNarrowViewport(): boolean {
  return mediaQueryMatches('(max-width: 700px)');
}

function isTabletOrMobileViewport(): boolean {
  return mediaQueryMatches('(max-width: 1024px)');
}

function mediaQueryMatches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(query).matches;
}
