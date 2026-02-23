import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AuthService } from '../services/auth.service';
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
    MatButtonModule,
    MatDividerModule
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
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="shell-toolbar">
          <button mat-icon-button *ngIf="isMobile" (click)="sidenav.toggle()" aria-label="Abrir menú">
            <mat-icon>menu</mat-icon>
          </button>
          <span class="shell-toolbar-title">my-warehouse</span>
          <span class="grow"></span>
          <span class="inline-chip" *ngIf="selectedWarehouseId">WH: {{ selectedWarehouseId }}</span>
          <button mat-icon-button aria-label="Escanear QR" routerLink="/app/scan">
            <mat-icon>qr_code_scanner</mat-icon>
          </button>
          <button mat-icon-button aria-label="Ir a configuración" routerLink="/app/settings">
            <mat-icon>tune</mat-icon>
          </button>
          <button mat-stroked-button type="button" (click)="logout()">Salir</button>
        </mat-toolbar>

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

  constructor(
    private readonly warehouseService: WarehouseService,
    private readonly authService: AuthService,
    private readonly router: Router,
    breakpointObserver: BreakpointObserver
  ) {
    breakpointObserver.observe('(max-width: 900px)').subscribe((res) => {
      this.isMobile = res.matches;
    });
  }

  closeIfMobile(): void {
    if (this.isMobile) {
      this.sidenav?.close();
    }
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigateByUrl('/login');
      },
      error: () => {
        this.authService.clearTokens();
        this.router.navigateByUrl('/login');
      }
    });
  }
}
