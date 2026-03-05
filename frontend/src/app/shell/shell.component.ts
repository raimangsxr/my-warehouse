import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, filter } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { IntakeBatch, IntakeService } from '../services/intake.service';
import { NotificationService } from '../services/notification.service';
import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatButtonModule,
    MatDividerModule,
    MatTooltipModule
  ],
  template: `
    <mat-sidenav-container class="shell-container">
      <mat-sidenav #sidenav class="shell-sidenav" [mode]="isMobile ? 'over' : 'side'" [opened]="!isMobile">
        <div class="shell-brand">
          <p class="shell-brand-title">my-warehouse</p>
          <p class="shell-brand-subtitle">Inventario multiusuario con QR</p>
        </div>
        <mat-divider />
        <mat-nav-list>
          <a mat-list-item class="shell-link" routerLink="/app/home" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
            <mat-icon matListItemIcon>home</mat-icon>
            <span matListItemTitle>Inicio</span>
          </a>
          <a mat-list-item class="shell-link" routerLink="/app/boxes" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
            <mat-icon matListItemIcon>inventory_2</mat-icon>
            <span matListItemTitle>Cajas</span>
          </a>
          <a mat-list-item class="shell-link" routerLink="/app/scan" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
            <mat-icon matListItemIcon>qr_code_scanner</mat-icon>
            <span matListItemTitle>Escanear QR</span>
          </a>
          <a mat-list-item class="shell-link" routerLink="/app/trash" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
            <mat-icon matListItemIcon>delete</mat-icon>
            <span matListItemTitle>Papelera</span>
          </a>
          <a mat-list-item class="shell-link" routerLink="/app/activity" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
            <mat-icon matListItemIcon>history</mat-icon>
            <span matListItemTitle>Actividad</span>
          </a>
          <a mat-list-item class="shell-link" routerLink="/app/conflicts" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
            <mat-icon matListItemIcon>sync_problem</mat-icon>
            <span matListItemTitle>Conflictos</span>
          </a>
          <a mat-list-item class="shell-link" routerLink="/app/settings" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
            <mat-icon matListItemIcon>settings</mat-icon>
            <span matListItemTitle>Configuración</span>
          </a>
          <a mat-list-item class="shell-link" routerLink="/warehouses" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
            <mat-icon matListItemIcon>warehouse</mat-icon>
            <span matListItemTitle>Warehouses</span>
          </a>
        </mat-nav-list>
        <mat-divider *ngIf="draftBatches.length > 0" />
        <div class="shell-section" *ngIf="draftBatches.length > 0">
          <p class="shell-section-title">Lotes en borrador</p>
          <div class="shell-draft-list">
            <div class="shell-draft-item" *ngFor="let batch of draftBatches; trackBy: trackByBatchId">
              <button
                type="button"
                class="shell-draft-open"
                [routerLink]="['/app/items/intake-batch']"
                [queryParams]="{ batchId: batch.id }"
                (click)="closeIfMobile()"
              >
                <mat-icon>collections</mat-icon>
                <span class="shell-draft-copy">
                  <span class="shell-draft-title">{{ draftBatchTitle(batch) }}</span>
                  <span class="shell-draft-subtitle">{{ draftBatchSubtitle(batch) }}</span>
                </span>
              </button>
              <button
                mat-icon-button
                type="button"
                class="shell-draft-delete"
                matTooltip="Eliminar lote"
                aria-label="Eliminar lote"
                (click)="deleteBatchFromPanel(batch, $event)"
                [disabled]="batch.status === 'processing'"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="shell-toolbar" [class.shell-toolbar-mobile]="isMobile">
          <button mat-icon-button *ngIf="isMobile" (click)="sidenav.toggle()" aria-label="Abrir menú">
            <mat-icon>menu</mat-icon>
          </button>
          <span class="shell-toolbar-title">my-warehouse</span>
          <span class="grow"></span>
          <ng-container *ngIf="!isMobile; else mobileActions">
            <span class="inline-chip shell-warehouse-chip" *ngIf="selectedWarehouseId">WH: {{ selectedWarehouseId }}</span>
            <button mat-icon-button aria-label="Escanear QR" routerLink="/app/scan">
              <mat-icon>qr_code_scanner</mat-icon>
            </button>
            <button mat-icon-button aria-label="Añadir artículo por foto" routerLink="/app/items/from-photo">
              <mat-icon>photo_camera</mat-icon>
            </button>
            <button mat-icon-button aria-label="Captura masiva por caja" routerLink="/app/items/intake-batch">
              <mat-icon>collections</mat-icon>
            </button>
            <button mat-icon-button aria-label="Ir a configuración" routerLink="/app/settings">
              <mat-icon>tune</mat-icon>
            </button>
            <button mat-stroked-button type="button" (click)="logout()">Salir</button>
          </ng-container>
          <ng-template #mobileActions>
            <button mat-icon-button aria-label="Escanear QR" routerLink="/app/scan">
              <mat-icon>qr_code_scanner</mat-icon>
            </button>
            <button mat-icon-button [matMenuTriggerFor]="mobileToolbarMenu" aria-label="Más acciones">
              <mat-icon>more_vert</mat-icon>
            </button>
          </ng-template>
        </mat-toolbar>
        <mat-menu #mobileToolbarMenu="matMenu">
          <button mat-menu-item routerLink="/app/items/from-photo">
            <mat-icon>photo_camera</mat-icon>
            <span>Nuevo por foto</span>
          </button>
          <button mat-menu-item routerLink="/app/items/intake-batch">
            <mat-icon>collections</mat-icon>
            <span>Captura masiva</span>
          </button>
          <button mat-menu-item routerLink="/app/settings">
            <mat-icon>tune</mat-icon>
            <span>Configuración</span>
          </button>
          <button mat-menu-item routerLink="/warehouses">
            <mat-icon>warehouse</mat-icon>
            <span>Warehouses</span>
          </button>
          <button mat-menu-item type="button" (click)="logout()">
            <mat-icon>logout</mat-icon>
            <span>Salir</span>
          </button>
        </mat-menu>

        <main class="shell-content">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .shell-section {
        padding: 10px 8px 6px;
      }

      .shell-section-title {
        margin: 0 8px 6px;
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
      }

      .shell-draft-list {
        display: grid;
        gap: 6px;
      }

      .shell-draft-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 36px;
        align-items: center;
        gap: 4px;
        border: 1px solid var(--border-soft);
        border-radius: 10px;
        background: #ffffff;
      }

      .shell-draft-open {
        width: 100%;
        min-width: 0;
        border: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        cursor: pointer;
      }

      .shell-draft-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .shell-draft-title,
      .shell-draft-subtitle {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .shell-draft-title {
        font-size: 0.83rem;
        font-weight: 600;
      }

      .shell-draft-subtitle {
        font-size: 0.74rem;
        color: var(--text-muted);
      }

      .shell-draft-delete {
        margin-right: 2px;
      }
    `
  ]
})
export class ShellComponent implements OnInit, OnDestroy {
  @ViewChild('sidenav') sidenav?: MatSidenav;

  isMobile = false;
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();
  draftBatches: IntakeBatch[] = [];
  private navigationSub?: Subscription;

  constructor(
    private readonly warehouseService: WarehouseService,
    private readonly intakeService: IntakeService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly notificationService: NotificationService,
    breakpointObserver: BreakpointObserver
  ) {
    breakpointObserver.observe('(max-width: 900px)').subscribe((res) => {
      this.isMobile = res.matches;
    });
  }

  ngOnInit(): void {
    this.loadDraftBatches();
    this.navigationSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.loadDraftBatches());
  }

  ngOnDestroy(): void {
    this.navigationSub?.unsubscribe();
  }

  closeIfMobile(): void {
    if (this.isMobile) {
      this.sidenav?.close();
    }
  }

  trackByBatchId(_index: number, batch: IntakeBatch): string {
    return batch.id;
  }

  draftBatchTitle(batch: IntakeBatch): string {
    return batch.name || `Lote ${batch.id.slice(0, 8)}`;
  }

  draftBatchSubtitle(batch: IntakeBatch): string {
    const pending = Math.max(batch.total_count - batch.committed_count, 0);
    const pendingLabel = pending === 1 ? '1 producto pendiente' : `${pending} productos pendientes`;
    return `${this.statusLabel(batch.status)} · ${pendingLabel}`;
  }

  deleteBatchFromPanel(batch: IntakeBatch, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (batch.status === 'processing' || !this.selectedWarehouseId) {
      return;
    }

    const label = this.draftBatchTitle(batch);
    const confirmed = window.confirm(`¿Eliminar el lote "${label}"? Esta acción no se puede deshacer.`);
    if (!confirmed) {
      return;
    }

    this.intakeService.deleteBatch(this.selectedWarehouseId, batch.id).subscribe({
      next: () => {
        this.draftBatches = this.draftBatches.filter((row) => row.id !== batch.id);
        this.notificationService.success('Lote eliminado.');
        if (this.isViewingBatch(batch.id)) {
          this.router
            .navigate(['/app/items/intake-batch'], {
              queryParams: { batchId: null },
              queryParamsHandling: 'merge'
            })
            .catch(() => {});
        }
      },
      error: () => {
        this.notificationService.error('No se pudo eliminar el lote.');
      }
    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.notificationService.info('Sesión cerrada.');
        this.router.navigateByUrl('/login');
      },
      error: () => {
        this.authService.clearTokens();
        this.notificationService.error('La sesión se cerró localmente por un error de red.');
        this.router.navigateByUrl('/login');
      }
    });
  }

  private loadDraftBatches(): void {
    if (!this.selectedWarehouseId) {
      this.draftBatches = [];
      return;
    }

    this.intakeService
      .listBatches(this.selectedWarehouseId, {
        include_committed: false,
        only_mine: true,
        limit: 12
      })
      .subscribe({
        next: (batches) => {
          this.draftBatches = batches.filter((batch) => batch.total_count > batch.committed_count);
        },
        error: () => {
          this.draftBatches = [];
        }
      });
  }

  private statusLabel(status: IntakeBatch['status']): string {
    const labels: Record<IntakeBatch['status'], string> = {
      drafting: 'Borrador',
      processing: 'Procesando',
      review: 'Revisión',
      committed: 'Comprometido'
    };
    return labels[status];
  }

  private isViewingBatch(batchId: string): boolean {
    const tree = this.router.parseUrl(this.router.url);
    return tree.queryParamMap.get('batchId') === batchId;
  }
}
