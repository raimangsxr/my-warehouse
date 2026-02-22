import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
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
    ReactiveFormsModule,
    RouterLink,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatListModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <mat-sidenav-container style="height: 100vh">
      <mat-sidenav #sidenav [mode]="isMobile ? 'over' : 'side'" [opened]="!isMobile">
        <mat-nav-list>
          <a mat-list-item routerLink="/app" (click)="closeIfMobile()">Home</a>
          <a mat-list-item routerLink="/warehouses" (click)="closeIfMobile()">Warehouses</a>
          <a mat-list-item routerLink="/app" (click)="closeIfMobile()">Settings</a>
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

        <div style="padding: 16px; max-width: 420px">
          <h3>Cambiar contraseña</h3>
          <form [formGroup]="passwordForm" (ngSubmit)="changePassword()">
            <mat-form-field class="full-width">
              <mat-label>Contraseña actual</mat-label>
              <input matInput type="password" formControlName="currentPassword" />
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>Nueva contraseña</mat-label>
              <input matInput type="password" formControlName="newPassword" />
            </mat-form-field>
            <div class="error" *ngIf="passwordError">{{ passwordError }}</div>
            <div *ngIf="passwordMessage">{{ passwordMessage }}</div>
            <button mat-flat-button color="primary" [disabled]="passwordForm.invalid || passwordLoading">
              {{ passwordLoading ? 'Guardando...' : 'Actualizar contraseña' }}
            </button>
          </form>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `
})
export class ShellComponent {
  @ViewChild('sidenav') sidenav?: MatSidenav;

  isMobile = false;
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();
  passwordLoading = false;
  passwordError = '';
  passwordMessage = '';

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(8)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  constructor(
    private readonly warehouseService: WarehouseService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly fb: FormBuilder,
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

  changePassword(): void {
    if (this.passwordForm.invalid || this.passwordLoading) {
      return;
    }

    this.passwordLoading = true;
    this.passwordError = '';
    this.passwordMessage = '';

    const raw = this.passwordForm.getRawValue();
    this.authService.changePassword(raw.currentPassword, raw.newPassword).subscribe({
      next: (res) => {
        this.passwordLoading = false;
        this.passwordMessage = res.message;
        this.passwordForm.reset();
      },
      error: () => {
        this.passwordLoading = false;
        this.passwordError = 'No se pudo cambiar la contraseña.';
      }
    });
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
