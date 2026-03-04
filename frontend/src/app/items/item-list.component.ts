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
                    (click)="favoriteToggle.emit(item)"
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
                    (click)="stockAdjust.emit({ item, delta: 1 })"
                    [attr.aria-label]="'Incrementar stock de ' + item.name"
                    matTooltip="Incrementar stock"
                  >
                    <mat-icon>add</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    class="compact-icon-action"
                    type="button"
                    (click)="stockAdjust.emit({ item, delta: -1 })"
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

      .col-route {
        width: 340px;
        min-width: 300px;
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

      .product-avatar {
        width: 36px;
        height: 36px;
        border-radius: 9px;
        border: 1px solid var(--border-soft);
        background: #fff;
        overflow: hidden;
        display: grid;
        place-items: center;
      }

      .table-avatar {
        width: 32px;
        height: 32px;
        flex-basis: 32px;
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
        max-width: 520px;
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

      .compact-icon-action {
        width: 32px !important;
        height: 32px !important;
        padding: 4px !important;
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
