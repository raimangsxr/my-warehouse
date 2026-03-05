import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { generateUuid } from '../core/uuid';
import { ItemCardComponent } from '../items/item-card.component';
import { ItemListComponent } from '../items/item-list.component';
import { Box, BoxItem, BoxService } from '../services/box.service';
import { BoxLabelPrintService } from '../services/box-label-print.service';
import { ItemService } from '../services/item.service';
import { NotificationService } from '../services/notification.service';
import { SettingsService } from '../services/settings.service';
import { SyncService } from '../services/sync.service';
import { WarehouseService } from '../services/warehouse.service';

type DetailViewMode = 'cards' | 'list';

@Component({
  selector: 'app-box-detail',
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
    MatChipsModule,
    MatTooltipModule,
    ItemCardComponent,
    ItemListComponent
  ],
  template: `
    <div class="app-page" *ngIf="box">
      <header class="page-header box-detail-header">
        <div>
          <h1 class="page-title">{{ box.name }}</h1>
          <p class="page-subtitle">Detalle recursivo de contenido y rutas navegables</p>
        </div>
        <div class="box-detail-header-actions" role="group" aria-label="Acciones de la caja">
          <button mat-icon-button type="button" matTooltip="Imprimir etiqueta" (click)="printLabel()">
            <mat-icon>print</mat-icon>
          </button>
          <button
            mat-icon-button
            type="button"
            [routerLink]="['/app/items/new']"
            [queryParams]="{ boxId: box.id }"
            matTooltip="Nuevo elemento"
          >
            <mat-icon>add</mat-icon>
          </button>
          <button
            mat-icon-button
            type="button"
            [routerLink]="['/app/items/from-photo']"
            [queryParams]="{ boxId: box.id, lockBox: 1 }"
            matTooltip="Añadir por foto"
          >
            <mat-icon>photo_camera</mat-icon>
          </button>
          <button
            mat-icon-button
            type="button"
            [routerLink]="['/app/batches']"
            [queryParams]="{ boxId: box.id, lockBox: 1 }"
            matTooltip="Captura masiva"
          >
            <mat-icon>collections</mat-icon>
          </button>
        </div>
      </header>

      <mat-card class="surface-card">
        <mat-card-content>
          <div class="inline-actions">
            <span class="inline-chip">Código: {{ box.short_code }}</span>
            <span class="inline-chip">Token QR: {{ box.qr_token }}</span>
          </div>

          <div [formGroup]="searchForm" class="form-row mt-10">
            <mat-form-field class="grow">
              <mat-label>Buscar dentro de esta caja</mat-label>
              <mat-icon matPrefix>search</mat-icon>
              <input matInput formControlName="q" />
            </mat-form-field>
            <div class="inline-actions">
              <button mat-stroked-button type="button" (click)="clearSearch()">Limpiar</button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-content>
          <section class="results-toolbar" aria-label="Preferencias de visualización de resultados">
            <div>
              <p class="results-title">Artículos en subárbol</p>
              <p class="results-count">{{ items.length }} resultados</p>
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

          <ng-container *ngIf="items.length > 0; else noItems">
            <div class="cards-grid" *ngIf="effectiveViewMode === 'cards'; else listView">
              <app-item-card
                *ngFor="let item of items"
                [item]="item"
                [isMobileView]="isMobileView"
                [isReprocessing]="reprocessingItemIds.has(item.id)"
                [enablePhotoPreview]="true"
                [showPathLinks]="true"
                [boxPathIds]="item.box_path_ids"
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
                [reprocessingItemIds]="reprocessingItemIds"
                [enablePhotoPreview]="true"
                [showPathLinks]="true"
                [boxPathIdsByItemId]="boxPathIdsByItemId"
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

          <ng-template #noItems>
            <div class="empty-state">No hay artículos para mostrar en esta caja.</div>
          </ng-template>
        </mat-card-content>
      </mat-card>

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
      .box-detail-header {
        align-items: flex-start;
      }

      .box-detail-header-actions {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 1px solid var(--border-soft);
        border-radius: 999px;
        padding: 2px;
        background: linear-gradient(180deg, #ffffff 0%, #f7f9fd 100%);
      }

      .box-detail-header-actions .mat-mdc-icon-button {
        color: #334155;
      }

      .results-toolbar {
        margin-bottom: 10px;
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

      .cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 10px;
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
      }

      @media (max-width: 640px) {
        .box-detail-header {
          gap: 10px;
        }

        .box-detail-header-actions {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-radius: 12px;
          gap: 8px;
          padding: 8px;
        }

        .box-detail-header-actions .mat-mdc-icon-button {
          width: 100% !important;
          border-radius: 10px;
          border: 1px solid var(--border-soft);
          background: #fff;
        }

        .cards-grid {
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .avatar-preview-panel {
          width: calc(100vw - 18px);
          max-width: 360px;
        }
      }
    `
  ]
})
export class BoxDetailComponent implements OnInit, OnDestroy {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();
  private readonly viewModeStorageKey = 'box_detail_view_mode';
  private readonly destroy$ = new Subject<void>();

  box: Box | null = null;
  items: BoxItem[] = [];
  reprocessingItemIds = new Set<string>();
  boxPathIdsByItemId: Record<string, string[]> = {};
  viewMode: DetailViewMode = 'cards';
  isMobileView = isNarrowViewport();

  avatarPreviewUrl: string | null = null;
  avatarPreviewName = '';
  avatarPreviewPinned = false;
  avatarPreviewStyle: Record<string, string> = {};
  private avatarPreviewHovering = false;

  readonly searchForm = this.fb.nonNullable.group({
    q: ''
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly boxService: BoxService,
    private readonly itemService: ItemService,
    private readonly settingsService: SettingsService,
    private readonly syncService: SyncService,
    private readonly boxLabelPrintService: BoxLabelPrintService,
    private readonly warehouseService: WarehouseService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    const boxId = this.route.snapshot.paramMap.get('id');
    if (!this.selectedWarehouseId || !boxId) {
      this.router.navigateByUrl('/app/boxes');
      return;
    }

    this.viewMode = this.readStoredViewMode();
    this.syncViewportState();

    this.boxService.get(this.selectedWarehouseId, boxId).subscribe({
      next: (box) => {
        this.box = box;
        this.loadItems();
      },
      error: () => {
        this.notificationService.error('No se pudo cargar la caja.');
        this.router.navigateByUrl('/app/boxes');
      }
    });

    this.searchForm.controls.q.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
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

  get effectiveViewMode(): DetailViewMode {
    return this.isMobileView ? 'cards' : this.viewMode;
  }

  loadItems(): void {
    if (!this.selectedWarehouseId || !this.box) {
      return;
    }
    const q = this.searchForm.controls.q.value.trim();
    this.boxService.listRecursiveItems(this.selectedWarehouseId, this.box.id, q).subscribe({
      next: (items) => {
        this.items = items;
        this.boxPathIdsByItemId = items.reduce((acc, item) => {
          acc[item.id] = item.box_path_ids;
          return acc;
        }, {} as Record<string, string[]>);
      },
      error: () => {
        this.notificationService.error('No se pudieron cargar los artículos de la caja.');
      }
    });
  }

  clearSearch(): void {
    this.searchForm.reset({ q: '' }, { emitEvent: false });
    this.loadItems();
  }

  toggleFavorite(item: BoxItem): void {
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
        this.notificationService.info('Sin conexión: favorito en cola para sincronizar.');
      }
    });
  }

  adjustStock(item: BoxItem, delta: 1 | -1): void {
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
        this.notificationService.info('Sin conexión: ajuste de stock en cola para sincronizar.');
      }
    });
  }

  deleteItem(item: BoxItem): void {
    if (!this.selectedWarehouseId) {
      return;
    }
    if (!confirm(`¿Enviar "${item.name}" a papelera?`)) {
      return;
    }

    this.itemService.delete(this.selectedWarehouseId, item.id).subscribe({
      next: () => {
        this.items = this.items.filter((current) => current.id !== item.id);
        delete this.boxPathIdsByItemId[item.id];
        this.notificationService.success('Artículo enviado a papelera.');
      },
      error: () => {
        this.notificationService.error('No se pudo borrar el artículo.');
      }
    });
  }

  reprocessItemTags(item: BoxItem): void {
    if (!this.selectedWarehouseId || this.reprocessingItemIds.has(item.id)) {
      return;
    }

    this.reprocessingItemIds.add(item.id);
    this.settingsService.reprocessItem(this.selectedWarehouseId, item.id, ['tags']).subscribe({
      next: (res) => {
        this.reprocessingItemIds.delete(item.id);
        this.upsertItem({ ...item, tags: res.tags });
        this.notificationService.success('Tags reprocesados.');
      },
      error: () => {
        this.reprocessingItemIds.delete(item.id);
        this.notificationService.error('No se pudieron reprocesar los tags del artículo.');
      }
    });
  }

  onAvatarMouseEnter(item: BoxItem, event: MouseEvent): void {
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

  onAvatarClick(item: BoxItem, event: MouseEvent): void {
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

  onAvatarKey(item: BoxItem, event: KeyboardEvent): void {
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

  printLabel(): void {
    if (!this.box) {
      return;
    }
    this.boxLabelPrintService.printLabel(this.box);
  }

  private upsertItem(updated: Partial<BoxItem> & { id: string }): void {
    this.items = this.items.map((current) => {
      if (current.id !== updated.id) {
        return current;
      }
      return {
        ...current,
        ...updated,
      };
    });
  }

  private readStoredViewMode(): DetailViewMode {
    const saved = localStorage.getItem(this.viewModeStorageKey);
    if (saved === 'cards' || saved === 'list') {
      return saved;
    }
    return 'cards';
  }

  private syncViewportState(): void {
    this.isMobileView = isNarrowViewport();
  }

  private openAvatarPreview(item: BoxItem, event: MouseEvent, pinned: boolean): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target || !item.photo_url) {
      return;
    }

    if (this.isMobileView || isCoarsePointerDevice()) {
      this.avatarPreviewUrl = item.photo_url;
      this.avatarPreviewName = item.name;
      this.avatarPreviewPinned = true;
      this.avatarPreviewHovering = false;
      this.avatarPreviewStyle = {
        width: 'calc(100vw - 18px)',
        left: '9px',
        top: 'auto',
        bottom: 'max(10px, env(safe-area-inset-bottom))'
      };
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
  return mediaQueryMatches('(hover: none), (pointer: coarse)');
}

function isNarrowViewport(): boolean {
  return mediaQueryMatches('(max-width: 700px)');
}

function mediaQueryMatches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(query).matches;
}
