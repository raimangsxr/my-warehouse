import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';

import { Warehouse, WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-warehouses',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <div class="page">
      <mat-card>
        <mat-card-title>Warehouses</mat-card-title>
        <mat-card-content>
          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
          <mat-list>
            <div class="row gap center-y" *ngFor="let warehouse of warehouses" style="margin-bottom: 8px">
              <button mat-stroked-button (click)="openWarehouse(warehouse.id)" class="grow">
                {{ warehouse.name }}
              </button>
              <button mat-button type="button" (click)="createInvite(warehouse.id)">Invitar</button>
            </div>
          </mat-list>
          <form [formGroup]="form" (ngSubmit)="createWarehouse()">
            <mat-form-field class="full-width">
              <mat-label>Nuevo warehouse</mat-label>
              <input matInput formControlName="name" />
            </mat-form-field>
            <button mat-flat-button color="primary" [disabled]="loading || form.invalid">
              {{ loading ? 'Creando...' : 'Crear warehouse' }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class WarehousesComponent implements OnInit {
  loading = false;
  errorMessage = '';
  warehouses: Warehouse[] = [];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly warehouseService: WarehouseService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadWarehouses();
  }

  createWarehouse(): void {
    if (this.form.invalid || this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.warehouseService.create(this.form.controls.name.value).subscribe({
      next: (warehouse) => {
        this.loading = false;
        this.form.reset();
        this.warehouseService.setSelectedWarehouseId(warehouse.id);
        this.loadWarehouses();
        this.router.navigateByUrl('/app/home');
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo crear el warehouse.';
      }
    });
  }

  openWarehouse(warehouseId: string): void {
    this.warehouseService.setSelectedWarehouseId(warehouseId);
    this.router.navigateByUrl('/app/home');
  }

  createInvite(warehouseId: string): void {
    const emailRaw = prompt('Email a invitar (opcional, dejar vacío para link genérico)');
    const email = emailRaw?.trim() || null;

    this.warehouseService.createInvite(warehouseId, { email }).subscribe({
      next: (invite) => {
        const message = `Invitación creada.\n\nLink:\n${invite.invite_url}\n\nToken:\n${invite.invite_token}`;
        alert(message);
      },
      error: () => {
        this.errorMessage = 'No se pudo crear la invitación.';
      }
    });
  }

  private loadWarehouses(): void {
    this.warehouseService.list().subscribe({
      next: (warehouses) => {
        this.warehouses = warehouses;
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar los warehouses.';
      }
    });
  }
}
