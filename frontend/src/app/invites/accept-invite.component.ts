import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div class="auth-layout">
      <div class="auth-shell">
        <section class="auth-panel">
          <h1>Invitación de warehouse</h1>
          <p>
            Confirma la invitación para unirte al espacio compartido y empezar a trabajar con el inventario.
          </p>
        </section>

        <mat-card class="auth-card">
          <mat-card-header>
            <mat-card-title>Aceptar invitación</mat-card-title>
            <mat-card-subtitle>Alta de membresía</mat-card-subtitle>
          </mat-card-header>
          <mat-progress-bar *ngIf="loading" mode="indeterminate" />
          <mat-card-content>
            <div class="list-row" *ngIf="loading">
              <mat-icon>hourglass_top</mat-icon>
              <span>Procesando invitación...</span>
            </div>
            <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
            <div class="status-message" *ngIf="successMessage">{{ successMessage }}</div>
          </mat-card-content>
          <mat-card-actions>
            <button mat-flat-button color="primary" (click)="goWarehouses()">Ir a warehouses</button>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `
})
export class AcceptInviteComponent implements OnInit {
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly warehouseService: WarehouseService
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.errorMessage = 'Token inválido.';
      return;
    }

    this.loading = true;
    this.warehouseService.acceptInvite(token).subscribe({
      next: (res) => {
        this.loading = false;
        this.warehouseService.setSelectedWarehouseId(res.warehouse_id);
        this.successMessage = 'Invitación aceptada correctamente.';
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 400) {
          this.errorMessage = 'La invitación está expirada o ya fue usada.';
          return;
        }
        if (err?.status === 403) {
          this.errorMessage = 'La invitación no corresponde a tu email.';
          return;
        }
        this.errorMessage = 'No se pudo aceptar la invitación.';
      }
    });
  }

  goWarehouses(): void {
    this.router.navigateByUrl('/warehouses');
  }
}
