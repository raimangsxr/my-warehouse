import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
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
    RouterOutlet,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatListModule,
    MatButtonModule
  ],
  template: `
    <mat-sidenav-container style="height: 100vh">
      <mat-sidenav #sidenav [mode]="isMobile ? 'over' : 'side'" [opened]="!isMobile">
        <mat-nav-list>
          <a mat-list-item routerLink="/app/home" (click)="closeIfMobile()">Home</a>
          <a mat-list-item routerLink="/app/boxes" (click)="closeIfMobile()">Cajas</a>
          <a mat-list-item routerLink="/app/settings" (click)="closeIfMobile()">Settings</a>
          <a mat-list-item routerLink="/warehouses" (click)="closeIfMobile()">Warehouses</a>
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content>
        <mat-toolbar color="primary">
          <button mat-icon-button *ngIf="isMobile" (click)="sidenav.toggle()" aria-label="Abrir menú">
            <mat-icon>menu</mat-icon>
          </button>
          <span>my-warehouse</span>
          <span style="flex: 1 1 auto"></span>
          <span style="margin-right: 16px" *ngIf="selectedWarehouseId">WH: {{ selectedWarehouseId }}</span>
          <mat-icon style="margin-right: 16px">qr_code_scanner</mat-icon>
          <button mat-stroked-button (click)="logout()">Salir</button>
        </mat-toolbar>

        <router-outlet />
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
    breakpointObserver.observe('(max-width: 768px)').subscribe((res) => {
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
