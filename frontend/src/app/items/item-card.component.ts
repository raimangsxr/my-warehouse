import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Item } from '../services/item.service';

@Component({
  selector: 'app-item-card',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCheckboxModule, MatIconModule, MatTooltipModule],
  template: `
    <article class="product-card">
      <div class="product-card-main">
        <mat-checkbox
          *ngIf="showSelection"
          class="item-select-checkbox"
          [checked]="isSelected"
          (change)="selectionToggle.emit()"
        ></mat-checkbox>

        <div
          class="product-avatar"
          [class.product-avatar-clickable]="enablePhotoPreview && !!item.photo_url"
          [attr.aria-hidden]="enablePhotoPreview && item.photo_url ? null : true"
          [attr.role]="enablePhotoPreview && item.photo_url ? 'button' : null"
          [attr.tabindex]="enablePhotoPreview && item.photo_url ? 0 : null"
          (mouseenter)="emitAvatarMouseEnter($event)"
          (mouseleave)="emitAvatarMouseLeave()"
          (click)="emitAvatarClick($event)"
          (keydown.enter)="emitAvatarKey($event)"
          (keydown.space)="emitAvatarKey($event)"
        >
          <img *ngIf="item.photo_url" [src]="item.photo_url" [alt]="'Foto de ' + item.name" loading="lazy" />
          <mat-icon *ngIf="!item.photo_url">inventory_2</mat-icon>
        </div>

        <div class="product-copy">
          <p class="product-title">{{ item.name }}</p>
          <p class="product-meta" [matTooltip]="item.description || 'Sin descripción'">{{ item.description || 'Sin descripción' }}</p>
          <p class="product-path" [class.product-path-inbound]="item.box_is_inbound" *ngIf="!canLinkPath; else linkedPath">
            {{ item.box_path.join(' > ') }}
          </p>
          <ng-template #linkedPath>
            <p class="product-path" [class.product-path-inbound]="item.box_is_inbound">
              <ng-container *ngFor="let segment of item.box_path; let idx = index">
                <a class="path-link" [routerLink]="['/app/boxes', boxPathIds[idx]]">{{ segment }}</a>
                <span *ngIf="idx < item.box_path.length - 1"> &gt; </span>
              </ng-container>
            </p>
          </ng-template>
        </div>
      </div>

      <div class="product-actions" [class.product-actions-mobile]="isMobileView">
        <div class="product-stock-inline">
          <button
            mat-icon-button
            type="button"
            class="stock-step-btn stock-step-dec"
            (click)="stockAdjust.emit(-1)"
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
            (click)="stockAdjust.emit(1)"
            [attr.aria-label]="'Incrementar stock de ' + item.name"
            matTooltip="Incrementar stock"
          >
            <mat-icon>add</mat-icon>
          </button>
        </div>
        <div class="product-quick-actions">
          <button
            mat-icon-button
            class="compact-icon-action"
            (click)="favoriteToggle.emit()"
            [attr.aria-label]="'Favorito ' + item.name"
            [matTooltip]="item.is_favorite ? 'Quitar favorito' : 'Marcar favorito'"
          >
            <mat-icon>{{ item.is_favorite ? 'star' : 'star_border' }}</mat-icon>
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
            (click)="reprocess.emit()"
            [disabled]="isReprocessing"
            [attr.aria-label]="'Reprocesar tags de ' + item.name"
            [matTooltip]="isReprocessing ? 'Reprocesando tags' : 'Reprocesar tags'"
          >
            <mat-icon>{{ isReprocessing ? 'hourglass_top' : 'auto_awesome' }}</mat-icon>
          </button>
          <button
            mat-icon-button
            color="warn"
            type="button"
            class="compact-icon-action"
            (click)="deleteItem.emit()"
            [attr.aria-label]="'Borrar ' + item.name"
            matTooltip="Borrar"
          >
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .product-card {
        border: 1px solid rgba(210, 220, 234, 0.92);
        border-radius: 12px;
        background: #ffffff;
        padding: 8px;
        display: grid;
        gap: 8px;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05), 0 8px 18px rgba(15, 23, 42, 0.06);
        transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
      }

      .product-card:hover {
        border-color: rgba(186, 202, 224, 0.96);
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.07), 0 11px 22px rgba(15, 23, 42, 0.08);
        transform: translateY(-1px);
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

      .product-path-inbound,
      .product-path-inbound .path-link {
        color: #b91c1c;
        font-weight: 600;
      }

      .path-link {
        color: inherit;
        text-decoration: none;
      }

      .path-link:hover {
        text-decoration: underline;
      }

      .product-actions {
        border-top: 1px solid rgba(219, 227, 239, 0.85);
        padding-top: 8px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        align-items: stretch;
      }

      .product-actions-mobile {
        gap: 8px;
      }

      .product-stock-inline {
        display: grid;
        grid-template-columns: 32px minmax(0, 1fr) 32px;
        align-items: center;
        gap: 3px;
        width: 100%;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid rgba(191, 216, 255, 0.8);
        background: #edf4ff;
        color: #234e9c;
        min-height: 38px;
      }

      .stock-display {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 56px;
        padding: 0 6px;
        font-size: 0.76rem;
        font-weight: 600;
      }

      .stock-display .mat-icon {
        width: 14px;
        height: 14px;
        font-size: 14px;
      }

      .stock-step-btn {
        width: 26px !important;
        height: 26px !important;
        min-width: 26px !important;
        padding: 0 !important;
      }

      .stock-step-dec {
        justify-self: start;
      }

      .stock-step-inc {
        justify-self: end;
      }

      .stock-step-btn .mat-icon {
        width: 14px;
        height: 14px;
        font-size: 14px;
      }

      .product-quick-actions {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }

      .compact-icon-action {
        width: 100% !important;
        max-width: none !important;
        height: 34px !important;
        padding: 6px !important;
        border-radius: 9px;
        border: 1px solid var(--border-soft);
        background: #ffffff;
      }

      @media (max-width: 640px) {
        .product-card {
          padding: 7px;
        }

        .product-actions-mobile .product-stock-inline {
          width: 100%;
          grid-template-columns: 34px minmax(0, 1fr) 34px;
          min-width: 0;
          border-radius: 12px;
          padding: 4px 10px;
          justify-self: stretch;
        }

        .product-actions-mobile .product-quick-actions {
          gap: 7px;
        }

        .stock-step-btn {
          width: 30px !important;
          height: 30px !important;
          min-width: 30px !important;
        }

        .compact-icon-action {
          width: 100% !important;
          max-width: none !important;
          height: 40px !important;
          padding: 8px !important;
        }
      }
    `
  ]
})
export class ItemCardComponent {
  @Input({ required: true }) item!: Item;
  @Input() showSelection = false;
  @Input() isSelected = false;
  @Input() isMobileView = false;
  @Input() isReprocessing = false;
  @Input() enablePhotoPreview = false;
  @Input() showPathLinks = false;
  @Input() boxPathIds: string[] = [];

  @Output() selectionToggle = new EventEmitter<void>();
  @Output() favoriteToggle = new EventEmitter<void>();
  @Output() stockAdjust = new EventEmitter<1 | -1>();
  @Output() reprocess = new EventEmitter<void>();
  @Output() deleteItem = new EventEmitter<void>();
  @Output() avatarMouseEnter = new EventEmitter<MouseEvent>();
  @Output() avatarMouseLeave = new EventEmitter<void>();
  @Output() avatarClick = new EventEmitter<MouseEvent>();
  @Output() avatarKey = new EventEmitter<KeyboardEvent>();

  get canLinkPath(): boolean {
    return this.showPathLinks && this.boxPathIds.length === this.item.box_path.length;
  }

  emitAvatarMouseEnter(event: MouseEvent): void {
    if (!this.enablePhotoPreview || !this.item.photo_url) {
      return;
    }
    this.avatarMouseEnter.emit(event);
  }

  emitAvatarMouseLeave(): void {
    if (!this.enablePhotoPreview) {
      return;
    }
    this.avatarMouseLeave.emit();
  }

  emitAvatarClick(event: MouseEvent): void {
    if (!this.enablePhotoPreview || !this.item.photo_url) {
      return;
    }
    this.avatarClick.emit(event);
  }

  emitAvatarKey(event: KeyboardEvent): void {
    if (!this.enablePhotoPreview || !this.item.photo_url) {
      return;
    }
    this.avatarKey.emit(event);
  }
}
