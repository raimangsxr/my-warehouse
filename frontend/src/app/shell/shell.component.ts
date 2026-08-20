import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { PwaService } from '../services/pwa.service';
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
          <a mat-list-item class="shell-link" routerLink="/app/warehouses" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
            <mat-icon matListItemIcon>warehouse</mat-icon>
            <span matListItemTitle>Warehouses</span>
          </a>
          <ng-container *ngIf="selectedWarehouseId()">
            <a mat-list-item class="shell-link" routerLink="/app/home" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
              <mat-icon matListItemIcon>home</mat-icon><span matListItemTitle>Inicio</span>
            </a>
            <a mat-list-item class="shell-link" routerLink="/app/boxes" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
              <mat-icon matListItemIcon>inventory_2</mat-icon><span matListItemTitle>Cajas</span>
            </a>
            <a mat-list-item class="shell-link" routerLink="/app/batches" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
              <mat-icon matListItemIcon>collections</mat-icon><span matListItemTitle>Lotes</span>
            </a>
            <a mat-list-item class="shell-link" routerLink="/app/scan" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
              <mat-icon matListItemIcon>qr_code_scanner</mat-icon><span matListItemTitle>Escanear QR</span>
            </a>
            <a mat-list-item class="shell-link" routerLink="/app/trash" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
              <mat-icon matListItemIcon>delete</mat-icon><span matListItemTitle>Papelera</span>
            </a>
            <a mat-list-item class="shell-link" routerLink="/app/activity" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
              <mat-icon matListItemIcon>history</mat-icon><span matListItemTitle>Actividad</span>
            </a>
            <a *ngIf="isAdministrator()" mat-list-item class="shell-link" routerLink="/app/conflicts" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
              <mat-icon matListItemIcon>sync_problem</mat-icon><span matListItemTitle>Conflictos</span>
            </a>
            <a *ngIf="isAdministrator()" mat-list-item class="shell-link" routerLink="/app/members" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
              <mat-icon matListItemIcon>group</mat-icon><span matListItemTitle>Miembros</span>
            </a>
            <a *ngIf="isAdministrator()" mat-list-item class="shell-link" routerLink="/app/settings" routerLinkActive="shell-link-active" (click)="closeIfMobile()">
              <mat-icon matListItemIcon>settings</mat-icon><span matListItemTitle>Configuración</span>
            </a>
          </ng-container>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="shell-toolbar" [class.shell-toolbar-mobile]="isMobile">
          <button mat-icon-button *ngIf="isMobile" (click)="sidenav.toggle()" aria-label="Abrir menú"><mat-icon>menu</mat-icon></button>
          <span class="shell-toolbar-title">my-warehouse</span>
          <span class="grow"></span>

          <button
            *ngIf="selectedWarehouseId() && !isMobile"
            mat-stroked-button
            class="shell-warehouse-button"
            routerLink="/app/warehouses"
            aria-label="Cambiar warehouse"
          >
            <mat-icon>warehouse</mat-icon>
            {{ selectedWarehouseName() || selectedWarehouseId() }} · {{ isAdministrator() ? 'Administrador' : 'Contribuidor' }}
          </button>
          <ng-container *ngIf="selectedWarehouseId()">
            <button *ngIf="!isMobile" mat-icon-button aria-label="Escanear QR" routerLink="/app/scan"><mat-icon>qr_code_scanner</mat-icon></button>
            <button *ngIf="!isMobile" mat-icon-button aria-label="Ir a lotes" routerLink="/app/batches"><mat-icon>collections</mat-icon></button>
            <button *ngIf="!isMobile" mat-icon-button aria-label="Añadir artículo por foto" routerLink="/app/items/from-photo"><mat-icon>photo_camera</mat-icon></button>
            <button *ngIf="isMobile" mat-icon-button aria-label="Cambiar warehouse" routerLink="/app/warehouses"><mat-icon>warehouse</mat-icon></button>
          </ng-container>
          <button mat-icon-button [matMenuTriggerFor]="userMenu" [attr.aria-label]="'Abrir perfil de ' + userLabel()">
            <mat-icon>account_circle</mat-icon>
          </button>
        </mat-toolbar>

        <mat-menu #userMenu="matMenu">
          <div class="shell-user-summary" (click)="$event.stopPropagation()">
            <strong>{{ userLabel() }}</strong>
            <span *ngIf="currentUser()?.display_name">{{ currentUser()?.email }}</span>
          </div>
          <mat-divider />
          <button mat-menu-item routerLink="/app/profile"><mat-icon>person</mat-icon><span>Perfil</span></button>
          <button mat-menu-item type="button" (click)="logout()"><mat-icon>logout</mat-icon><span>Cerrar sesión</span></button>
        </mat-menu>

        <main class="shell-content"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .shell-warehouse-button { max-width: min(360px, 34vw); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 6px; }
    .shell-user-summary { display: grid; gap: 2px; padding: 10px 16px; max-width: 280px; overflow-wrap: anywhere; }
    .shell-user-summary span { color: var(--text-2); font-size: .8rem; }
  `]
})
export class ShellComponent {
  @ViewChild('sidenav') sidenav?: MatSidenav;

  isMobile = false;
  readonly selectedWarehouseId = this.warehouseService.selectedWarehouseId;
  readonly selectedWarehouseName = this.warehouseService.selectedWarehouseName;
  readonly isAdministrator = this.warehouseService.isSelectedWarehouseAdministrator;
  readonly currentUser = this.authService.currentUser;

  constructor(
    private readonly warehouseService: WarehouseService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly notificationService: NotificationService,
    private readonly pwaService: PwaService,
    breakpointObserver: BreakpointObserver,
  ) {
    const updatedVersion = this.pwaService.consumePendingReloadSuccess();
    if (updatedVersion) {
      this.notificationService.success(`App actualizada correctamente a la versión ${updatedVersion}.`);
    }
    if (this.authService.isLoggedIn() && !this.currentUser()) {
      this.authService.me().subscribe({ error: () => undefined });
    }
    breakpointObserver.observe('(max-width: 900px)').subscribe((result) => {
      this.isMobile = result.matches;
    });
  }

  userLabel(): string {
    const user = this.currentUser();
    return user?.display_name || user?.email || 'Mi perfil';
  }

  closeIfMobile(): void {
    if (this.isMobile) this.sidenav?.close();
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.finishLogout('Sesión cerrada.'),
      error: () => {
        this.authService.clearTokens();
        this.finishLogout('La sesión se cerró localmente por un error de red.', true);
      },
    });
  }

  private finishLogout(message: string, isError = false): void {
    this.warehouseService.clearSelectedWarehouseId();
    if (isError) this.notificationService.error(message);
    else this.notificationService.info(message);
    this.router.navigateByUrl('/login');
  }
}
