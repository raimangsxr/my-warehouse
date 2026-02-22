import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  template: `
    <div class="page">
      <mat-card>
        <mat-card-title>Aceptar invitación</mat-card-title>
        <mat-card-content>
          <div *ngIf="loading">Procesando invitación...</div>
          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
          <div *ngIf="successMessage">{{ successMessage }}</div>
        </mat-card-content>
        <mat-card-actions>
          <button mat-flat-button color="primary" (click)="goWarehouses()">Ir a warehouses</button>
        </mat-card-actions>
      </mat-card>
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
        this.successMessage = 'Invitación aceptada.';
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
