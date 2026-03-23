import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { Component, effect, inject, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { PwaService } from '../services/pwa.service';
import { SyncService } from '../services/sync.service';
import { WarehouseService } from '../services/warehouse.service';
import { BackgroundJobsIndicatorComponent } from './background-jobs-indicator.component';

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
    MatTooltipModule,
    BackgroundJobsIndicatorComponent,
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
          <a mat-list-item class="shell-link" routerLink="/app/batches" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
            <mat-icon matListItemIcon>collections</mat-icon>
            <span matListItemTitle>Lotes</span>
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
          <a mat-list-item class="shell-link" routerLink="/app/reorganization" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
            <mat-icon matListItemIcon>auto_fix_high</mat-icon>
            <span matListItemTitle>Reorganización</span>
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
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="shell-toolbar" [class.shell-toolbar-mobile]="isMobile">
          <button mat-icon-button *ngIf="isMobile" (click)="sidenav.toggle()" aria-label="Abrir menú">
            <mat-icon>menu</mat-icon>
          </button>
          <span class="shell-toolbar-title">my-warehouse</span>
          <span class="grow"></span>
          <!-- Sync status indicator (always visible) -->
          <button
            mat-icon-button
            class="sync-status-btn"
            [class.sync-status-offline]="syncService.syncStatus() === 'offline'"
            [class.sync-status-pending]="syncService.syncStatus() === 'pending'"
            [class.sync-status-syncing]="syncService.syncStatus() === 'syncing'"
            [class.sync-status-error]="syncService.syncStatus() === 'error'"
            [matTooltip]="syncStatusTooltip()"
            aria-label="Estado de sincronización"
            type="button"
          >
            <mat-icon class="sync-status-icon" [class.sync-spin]="syncService.syncStatus() === 'syncing'">
              {{ syncStatusIcon() }}
            </mat-icon>
          </button>
          <!-- Background jobs indicator (always visible) -->
          <app-background-jobs-indicator />
          <ng-container *ngIf="!isMobile; else mobileActions">
            <span class="inline-chip shell-warehouse-chip" *ngIf="selectedWarehouseId">WH: {{ selectedWarehouseId }}</span>
            <button mat-icon-button aria-label="Escanear QR" routerLink="/app/scan">
              <mat-icon>qr_code_scanner</mat-icon>
            </button>
            <button mat-icon-button aria-label="Ir a lotes" routerLink="/app/batches">
              <mat-icon>collections</mat-icon>
            </button>
            <button mat-icon-button aria-label="Añadir artículo por foto" routerLink="/app/items/from-photo">
              <mat-icon>photo_camera</mat-icon>
            </button>
            <button
              mat-icon-button
              *ngIf="pwaService.canInstall()"
              aria-label="Instalar aplicación"
              type="button"
              (click)="installApp()"
            >
              <mat-icon>download_for_offline</mat-icon>
            </button>
            <button
              mat-icon-button
              *ngIf="pwaService.updateAvailable()"
              aria-label="Aplicar actualización"
              type="button"
              (click)="applyAppUpdate()"
            >
              <mat-icon>system_update_alt</mat-icon>
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
            <button mat-icon-button aria-label="Ir a lotes" routerLink="/app/batches">
              <mat-icon>collections</mat-icon>
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
          <button mat-menu-item routerLink="/app/settings">
            <mat-icon>tune</mat-icon>
            <span>Configuración</span>
          </button>
          <button mat-menu-item type="button" *ngIf="pwaService.canInstall()" (click)="installApp()">
            <mat-icon>download_for_offline</mat-icon>
            <span>Instalar app</span>
          </button>
          <button mat-menu-item type="button" *ngIf="pwaService.updateAvailable()" (click)="applyAppUpdate()">
            <mat-icon>system_update_alt</mat-icon>
            <span>Actualizar app</span>
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
  `
})
export class ShellComponent {
  @ViewChild('sidenav') sidenav?: MatSidenav;

  isMobile = false;
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();
  readonly syncService = inject(SyncService);
  private announcedUpdateVersion: string | null = null;

  constructor(
    private readonly warehouseService: WarehouseService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly notificationService: NotificationService,
    public readonly pwaService: PwaService,
    breakpointObserver: BreakpointObserver
  ) {
    const updatedVersion = this.pwaService.consumePendingReloadSuccess();
    if (updatedVersion) {
      this.notificationService.success(`App actualizada correctamente a la versión ${updatedVersion}.`);
    }

    breakpointObserver.observe('(max-width: 900px)').subscribe((res) => {
      this.isMobile = res.matches;
    });

    effect(() => {
      const updateAvailable = this.pwaService.updateAvailable();
      const latestVersion = this.pwaService.latestVersionLabel();
      if (!updateAvailable || !latestVersion || this.announcedUpdateVersion === latestVersion) {
        return;
      }
      this.announcedUpdateVersion = latestVersion;
      const currentVersion = this.pwaService.currentVersionLabel();
      const ref = this.notificationService.action(
        `Ha salido la versión ${latestVersion} de la app. Tienes ${currentVersion}.`,
        'Actualizar',
        'info',
        10000
      );
      ref.onAction().subscribe(() => {
        void this.applyAppUpdate();
      });
    });
  }

  syncStatusIcon(): string {
    switch (this.syncService.syncStatus()) {
      case 'offline': return 'cloud_off';
      case 'syncing': return 'sync';
      case 'pending': return 'cloud_upload';
      case 'error':   return 'sync_problem';
      default:        return 'cloud_done';
    }
  }

  syncStatusTooltip(): string {
    switch (this.syncService.syncStatus()) {
      case 'offline': return 'Sin conexión';
      case 'syncing': return 'Sincronizando…';
      case 'pending': return 'Cambios pendientes de sincronizar';
      case 'error':   return 'Error de sincronización';
      default:        return 'Sincronizado';
    }
  }

  closeIfMobile(): void {
    if (this.isMobile) {
      this.sidenav?.close();
    }
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

  async installApp(): Promise<void> {
    const result = await this.pwaService.promptInstall();
    if (result === 'accepted') {
      this.notificationService.success('La instalación de la app se ha iniciado.');
      return;
    }
    if (result === 'dismissed') {
      this.notificationService.info('La instalación se ha pospuesto.');
      return;
    }
    if (this.pwaService.showIosInstallHint()) {
      this.notificationService.info('En Safari usa Compartir > Añadir a pantalla de inicio.');
      return;
    }
    this.notificationService.info('La instalación estará disponible cuando el navegador valide la PWA en HTTPS.');
  }

  async applyAppUpdate(): Promise<void> {
    const result = await this.pwaService.activateUpdate();
    if (result.status === 'none') {
      this.notificationService.info('No hay actualizaciones pendientes para aplicar.');
      return;
    }
    if (result.status === 'error') {
      this.notificationService.error(result.message);
    }
  }
}
