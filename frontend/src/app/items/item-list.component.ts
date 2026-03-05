import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Item } from '../services/item.service';

@Component({
  selector: 'app-item-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCheckboxModule, MatIconModule, MatTooltipModule],
  template: `
    <section class="table-shell">
      <div class="table-scroll">
        <table class="inventory-table" aria-label="Listado de artículos">
          <thead>
            <tr>
              <th class="col-select" *ngIf="showSelection"></th>
              <th class="col-item">Artículo</th>
              <th class="col-route">Ruta</th>
              <th class="col-stock">Stock</th>
              <th class="col-tags">Tags</th>
              <th class="col-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of items">
              <td class="col-select" *ngIf="showSelection">
                <mat-checkbox
                  class="item-select-checkbox"
                  [checked]="selectedItemIds.has(item.id)"
                  (change)="selectionToggle.emit(item.id)"
                ></mat-checkbox>
              </td>
              <td class="col-item">
                <div class="table-item-cell">
                  <div
                    class="product-avatar table-avatar"
                    [class.product-avatar-clickable]="enablePhotoPreview && !!item.photo_url"
                    [attr.aria-hidden]="enablePhotoPreview && item.photo_url ? null : true"
                    [attr.role]="enablePhotoPreview && item.photo_url ? 'button' : null"
                    [attr.tabindex]="enablePhotoPreview && item.photo_url ? 0 : null"
                    (mouseenter)="emitAvatarMouseEnter(item, $event)"
                    (mouseleave)="emitAvatarMouseLeave()"
                    (click)="emitAvatarClick(item, $event)"
                    (keydown.enter)="emitAvatarKey(item, $event)"
                    (keydown.space)="emitAvatarKey(item, $event)"
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
              <td class="col-route route-text" [class.route-text-inbound]="item.box_is_inbound">
                <ng-container *ngIf="canLinkPath(item); else plainPath">
                  <ng-container *ngFor="let segment of item.box_path; let idx = index">
                    <a class="route-link" [routerLink]="['/app/boxes', pathIdsFor(item)[idx]]">{{ segment }}</a>
                    <span *ngIf="idx < item.box_path.length - 1"> &gt; </span>
                  </ng-container>
                </ng-container>
                <ng-template #plainPath>{{ item.box_path.join(' > ') }}</ng-template>
              </td>
              <td class="col-stock">
                <div class="product-stock-inline">
                  <button
                    mat-icon-button
                    type="button"
                    class="stock-step-btn stock-step-dec"
                    (click)="stockAdjust.emit({ item, delta: -1 })"
                    [attr.aria-label]="'Reducir stock de ' + item.name"
                    matTooltip="Reducir stock"
                  >
                    <mat-icon>remove</mat-icon>
                  </button>
                  <span class="stock-display" matTooltip="Stock actual">
                    <mat-icon>inventory_2</mat-icon>
                    <span>{{ item.stock }}</span>
                  </span>
                  <button
                    mat-icon-button
                    color="primary"
                    type="button"
                    class="stock-step-btn stock-step-inc"
                    (click)="stockAdjust.emit({ item, delta: 1 })"
                    [attr.aria-label]="'Incrementar stock de ' + item.name"
                    matTooltip="Incrementar stock"
                  >
                    <mat-icon>add</mat-icon>
                  </button>
                </div>
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
                    (click)="favoriteToggle.emit(item)"
                    [attr.aria-label]="'Favorito ' + item.name"
                    [matTooltip]="item.is_favorite ? 'Quitar favorito' : 'Marcar favorito'"
                  >
                    <mat-icon>{{ item.is_favorite ? 'star' : 'star_border' }}</mat-icon>
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
                    (click)="reprocess.emit(item)"
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
                    (click)="deleteItem.emit(item)"
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
  `,
  styles: [
    `
      :host {
        display: block;
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
        min-width: 920px;
        table-layout: fixed;
      }

      .inventory-table th {
        text-align: left;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: #64748b;
        text-transform: uppercase;
        padding: 9px 8px;
        border-bottom: 1px solid var(--border-soft);
        background: #f2f6fd;
        white-space: nowrap;
      }

      .inventory-table td {
        padding: 8px 8px;
        border-bottom: 1px solid rgba(219, 227, 239, 0.72);
        vertical-align: middle;
      }

      .inventory-table tbody tr:last-child td {
        border-bottom: none;
      }

      .col-select {
        width: 42px;
      }

      .col-item {
        width: 44%;
        min-width: 340px;
      }

      .col-stock {
        width: 132px;
      }

      .col-route {
        width: 18%;
        min-width: 170px;
      }

      .col-tags {
        width: 140px;
      }

      .col-actions {
        width: 178px;
      }

      .table-item-cell {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
      }

      .product-avatar {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        border: 1px solid var(--border-soft);
        background: #fff;
        overflow: hidden;
        display: grid;
        place-items: center;
      }

      .table-avatar {
        width: 30px;
        height: 30px;
        flex-basis: 30px;
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

      .product-avatar-clickable {
        cursor: zoom-in;
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
        font-size: 0.86rem;
        font-weight: 600;
        color: #1f2937;
        line-height: 1.24;
      }

      .table-item-subtitle {
        margin-top: 1px;
        font-size: 0.74rem;
        color: #64748b;
        line-height: 1.24;
      }

      .route-text {
        font-size: 0.79rem;
        color: #475569;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .route-text-inbound,
      .route-text-inbound .route-link {
        color: #b91c1c;
        font-weight: 600;
      }

      .route-link {
        color: inherit;
        text-decoration: none;
      }

      .route-link:hover {
        text-decoration: underline;
      }

      .table-tags {
        display: flex;
        align-items: center;
        gap: 3px;
        flex-wrap: wrap;
      }

      .table-tag {
        font-size: 0.7rem;
        border: 1px solid var(--border-soft);
        color: #475569;
        background: #eef3fa;
        border-radius: 999px;
        padding: 2px 6px;
      }

      .table-tag-more {
        font-size: 0.7rem;
        color: #64748b;
      }

      .table-actions {
        display: flex;
        align-items: center;
        gap: 3px;
        flex-wrap: nowrap;
      }

      .product-stock-inline {
        display: grid;
        grid-template-columns: 26px minmax(0, 1fr) 26px;
        align-items: center;
        gap: 2px;
        width: 100%;
        padding: 2px 6px;
        border-radius: 999px;
        border: 1px solid rgba(191, 216, 255, 0.82);
        background: #edf4ff;
        color: #234e9c;
        min-height: 32px;
      }

      .stock-display {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        min-width: 0;
        padding: 0 4px;
        font-size: 0.72rem;
        font-weight: 600;
        white-space: nowrap;
        line-height: 1;
      }

      .stock-display .mat-icon {
        width: 13px;
        height: 13px;
        font-size: 13px;
      }

      .stock-step-btn {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        width: 22px !important;
        min-width: 22px !important;
        height: 22px !important;
        padding: 0 !important;
        line-height: 1 !important;
      }

      .stock-step-btn .mat-icon {
        display: block;
        width: 14px;
        height: 14px;
        font-size: 14px;
        line-height: 14px;
        margin: 0;
        vertical-align: middle;
      }

      .stock-step-dec {
        justify-self: start;
      }

      .stock-step-inc {
        justify-self: end;
      }

      .compact-icon-action {
        width: 30px !important;
        min-width: 30px !important;
        height: 30px !important;
        padding: 3px !important;
      }

      .compact-icon-action .mat-icon {
        width: 16px;
        height: 16px;
        font-size: 16px;
      }

      @media (max-width: 900px) {
        .table-shell {
          border-radius: 12px;
        }
      }

      @media (max-width: 640px) {
        .compact-icon-action {
          width: 40px !important;
          height: 40px !important;
          padding: 8px !important;
        }
      }
    `
  ]
})
export class ItemListComponent {
  @Input() items: Item[] = [];
  @Input() showSelection = false;
  @Input() selectedItemIds: Set<string> = new Set<string>();
  @Input() reprocessingItemIds: Set<string> = new Set<string>();
  @Input() enablePhotoPreview = false;
  @Input() showPathLinks = false;
  @Input() boxPathIdsByItemId: Record<string, string[]> = {};

  @Output() selectionToggle = new EventEmitter<string>();
  @Output() favoriteToggle = new EventEmitter<Item>();
  @Output() stockAdjust = new EventEmitter<{ item: Item; delta: 1 | -1 }>();
  @Output() reprocess = new EventEmitter<Item>();
  @Output() deleteItem = new EventEmitter<Item>();
  @Output() avatarMouseEnter = new EventEmitter<{ item: Item; event: MouseEvent }>();
  @Output() avatarMouseLeave = new EventEmitter<void>();
  @Output() avatarClick = new EventEmitter<{ item: Item; event: MouseEvent }>();
  @Output() avatarKey = new EventEmitter<{ item: Item; event: KeyboardEvent }>();

  emitAvatarMouseEnter(item: Item, event: MouseEvent): void {
    if (!this.enablePhotoPreview || !item.photo_url) {
      return;
    }
    this.avatarMouseEnter.emit({ item, event });
  }

  emitAvatarMouseLeave(): void {
    if (!this.enablePhotoPreview) {
      return;
    }
    this.avatarMouseLeave.emit();
  }

  emitAvatarClick(item: Item, event: MouseEvent): void {
    if (!this.enablePhotoPreview || !item.photo_url) {
      return;
    }
    this.avatarClick.emit({ item, event });
  }

  emitAvatarKey(item: Item, event: KeyboardEvent): void {
    if (!this.enablePhotoPreview || !item.photo_url) {
      return;
    }
    this.avatarKey.emit({ item, event });
  }

  pathIdsFor(item: Item): string[] {
    return this.boxPathIdsByItemId[item.id] || [];
  }

  canLinkPath(item: Item): boolean {
    return this.showPathLinks && this.pathIdsFor(item).length === item.box_path.length;
  }
}
