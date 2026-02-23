import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { Warehouse, WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-warehouses',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule
  ],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Tus warehouses</h1>
          <p class="page-subtitle">Selecciona un espacio de trabajo o crea uno nuevo</p>
        </div>
      </header>

      <div class="form-row">
        <mat-card class="surface-card">
          <mat-card-content>
            <div class="card-header-row">
              <div>
                <h2 class="card-title">Espacios disponibles</h2>
                <p class="card-subtitle">Acceso multiusuario sin roles</p>
              </div>
            </div>

            <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>

            <div class="list-grid" *ngIf="warehouses.length > 0; else emptyWarehouses">
              <div class="item-card" *ngFor="let warehouse of warehouses">
                <div class="list-row">
                  <mat-icon>warehouse</mat-icon>
                  <div class="grow">
                    <p class="item-card-title">{{ warehouse.name }}</p>
                    <div class="item-card-meta">
                      <span>ID: {{ warehouse.id }}</span>
                    </div>
                  </div>
                </div>
                <div class="inline-actions">
                  <button mat-flat-button color="primary" type="button" (click)="openWarehouse(warehouse.id)">
                    Abrir
                  </button>
                </div>
              </div>
            </div>

            <ng-template #emptyWarehouses>
              <div class="empty-state">No tienes warehouses todavía. Crea uno para empezar.</div>
            </ng-template>
          </mat-card-content>
        </mat-card>

        <div>
          <mat-card class="surface-card">
            <mat-card-content>
              <h2 class="card-title">Crear warehouse</h2>
              <p class="card-subtitle">Se te asignará como miembro automáticamente</p>

              <form [formGroup]="form" (ngSubmit)="createWarehouse()" class="form-stack" style="margin-top: 10px">
                <mat-form-field class="full-width">
                  <mat-label>Nombre</mat-label>
                  <mat-icon matPrefix>inventory_2</mat-icon>
                  <input matInput formControlName="name" />
                </mat-form-field>

                <button mat-flat-button color="primary" [disabled]="loading || form.invalid">
                  {{ loading ? 'Creando...' : 'Crear warehouse' }}
                </button>
              </form>
            </mat-card-content>
          </mat-card>

          <mat-card class="surface-card">
            <mat-card-content>
              <h2 class="card-title">Invitar miembro</h2>
              <p class="card-subtitle">Genera un enlace de invitación por warehouse</p>

              <form [formGroup]="inviteForm" (ngSubmit)="createInvite()" class="form-stack" style="margin-top: 10px">
                <mat-form-field class="full-width">
                  <mat-label>Warehouse</mat-label>
                  <mat-select formControlName="warehouseId">
                    <mat-option *ngFor="let warehouse of warehouses" [value]="warehouse.id">
                      {{ warehouse.name }}
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field class="full-width">
                  <mat-label>Email (opcional)</mat-label>
                  <mat-icon matPrefix>mail</mat-icon>
                  <input matInput formControlName="email" placeholder="usuario@correo.com" />
                </mat-form-field>

                <button mat-stroked-button color="primary" type="submit" [disabled]="inviteForm.invalid || inviteLoading">
                  {{ inviteLoading ? 'Generando...' : 'Generar invitación' }}
                </button>
              </form>

              <div class="error" *ngIf="inviteError" style="margin-top: 8px">{{ inviteError }}</div>
              <div class="status-message" *ngIf="inviteMessage" style="margin-top: 8px">{{ inviteMessage }}</div>

              <div class="item-card" *ngIf="inviteLink" style="margin-top: 10px">
                <div class="status-line"><strong>Link:</strong> {{ inviteLink }}</div>
                <div class="status-line"><strong>Token:</strong> {{ inviteToken }}</div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </div>
  `
})
export class WarehousesComponent implements OnInit {
  loading = false;
  inviteLoading = false;
  errorMessage = '';
  inviteError = '';
  inviteMessage = '';
  inviteLink = '';
  inviteToken = '';
  warehouses: Warehouse[] = [];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]]
  });

  readonly inviteForm = this.fb.group({
    warehouseId: ['', [Validators.required]],
    email: ['', [Validators.email]]
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

  createInvite(): void {
    if (this.inviteForm.invalid || this.inviteLoading) {
      return;
    }

    const warehouseId = this.inviteForm.controls.warehouseId.value;
    if (!warehouseId) {
      return;
    }

    const email = this.inviteForm.controls.email.value?.trim() || null;
    this.inviteLoading = true;
    this.inviteError = '';
    this.inviteMessage = '';

    this.warehouseService.createInvite(warehouseId, { email }).subscribe({
      next: (invite) => {
        this.inviteLoading = false;
        this.inviteLink = invite.invite_url;
        this.inviteToken = invite.invite_token;
        this.inviteMessage = 'Invitación creada.';
      },
      error: () => {
        this.inviteLoading = false;
        this.inviteError = 'No se pudo crear la invitación.';
      }
    });
  }

  private loadWarehouses(): void {
    this.warehouseService.list().subscribe({
      next: (warehouses) => {
        this.warehouses = warehouses;
        if (!this.inviteForm.controls.warehouseId.value && warehouses.length > 0) {
          this.inviteForm.patchValue({ warehouseId: warehouses[0].id });
        }
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar los warehouses.';
      }
    });
  }
}
