import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { HttpErrorResponse } from '@angular/common/http';

import { NotificationService } from '../services/notification.service';
import { SyncService } from '../services/sync.service';
import { Warehouse, WarehouseService } from '../services/warehouse.service';
import { APP_VERSION } from '../core/app-version';
import {
  WarehouseDeleteDialogComponent,
  WarehouseDeleteDialogData,
} from './warehouse-delete-dialog.component';

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
    MatIconModule,
    MatDialogModule,
  ],
  template: `
    <div class="warehouses-page">
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
                <p class="card-subtitle">Tu rol se aplica de forma independiente en cada espacio</p>
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
                      <span class="inline-chip">{{ roleLabel(warehouse.role) }}</span>
                    </div>
                  </div>
                </div>
                <div class="inline-actions">
                  <button mat-flat-button color="primary" type="button" (click)="openWarehouse(warehouse.id)">
                    Abrir
                  </button>
                  <button
                    mat-stroked-button
                    color="warn"
                    type="button"
                    *ngIf="canDeleteWarehouse(warehouse)"
                    [disabled]="!isOnline || deletingWarehouseId === warehouse.id"
                    (click)="confirmDeleteWarehouse(warehouse)"
                  >
                    Eliminar
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
              <p class="card-subtitle">Serás Administrador del nuevo warehouse</p>

              <form [formGroup]="form" (ngSubmit)="createWarehouse()" class="form-stack mt-10">
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

          <mat-card class="surface-card" *ngIf="administratorWarehouses.length > 0">
            <mat-card-content>
              <h2 class="card-title">Invitar miembro</h2>
              <p class="card-subtitle">Genera un enlace de invitación por warehouse</p>

              <form [formGroup]="inviteForm" (ngSubmit)="createInvite()" class="form-stack mt-10">
                <mat-form-field class="full-width">
                  <mat-label>Warehouse</mat-label>
                  <mat-select formControlName="warehouseId">
                    <mat-option *ngFor="let warehouse of administratorWarehouses" [value]="warehouse.id">
                      {{ warehouse.name }}
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field class="full-width">
                  <mat-label>Email (opcional)</mat-label>
                  <mat-icon matPrefix>mail</mat-icon>
                  <input matInput formControlName="email" placeholder="usuario@correo.com" />
                </mat-form-field>

                <mat-form-field class="full-width">
                  <mat-label>Rol</mat-label>
                  <mat-select formControlName="role">
                    <mat-option value="contributor">Contribuidor</mat-option>
                    <mat-option value="administrator">Administrador</mat-option>
                  </mat-select>
                </mat-form-field>

                <button mat-stroked-button color="primary" type="submit" [disabled]="inviteForm.invalid || inviteLoading">
                  {{ inviteLoading ? 'Generando...' : 'Generar invitación' }}
                </button>
              </form>

              <div class="error mt-8" *ngIf="inviteError">{{ inviteError }}</div>
              <div class="status-message mt-8" *ngIf="inviteMessage">{{ inviteMessage }}</div>

              <div class="item-card invite-link-card mt-10" *ngIf="inviteLink">
                <div class="status-line"><strong>Link:</strong> {{ inviteLink }}</div>
                <div class="status-line"><strong>Token:</strong> {{ inviteToken }}</div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
      </div>

      <footer class="warehouses-footer">
        <p class="warehouses-version">Versión {{ appVersion }}</p>
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }

      .warehouses-page {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      .warehouses-page .app-page {
        flex: 1;
      }

      .warehouses-footer {
        padding: 0 20px calc(16px + env(safe-area-inset-bottom));
        text-align: center;
      }

      .warehouses-version {
        margin: 0;
        font-size: 0.8rem;
        color: var(--text-3);
      }

      .invite-link-card .status-line {
        word-break: break-word;
      }

      .inline-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class WarehousesComponent implements OnInit {
  protected readonly appVersion = APP_VERSION;

  loading = false;
  inviteLoading = false;
  deletingWarehouseId: string | null = null;
  errorMessage = '';
  inviteError = '';
  inviteMessage = '';
  inviteLink = '';
  inviteToken = '';
  warehouses: Warehouse[] = [];

  get administratorWarehouses(): Warehouse[] {
    return this.warehouses.filter((warehouse) => warehouse.role === 'administrator');
  }

  get isOnline(): boolean {
    return this.syncService.isOnline();
  }

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });

  readonly inviteForm = this.fb.group({
    warehouseId: ['', [Validators.required]],
    email: ['', [Validators.email]],
    role: this.fb.nonNullable.control<'administrator' | 'contributor'>('contributor'),
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly warehouseService: WarehouseService,
    private readonly syncService: SyncService,
    private readonly dialog: MatDialog,
    private readonly router: Router,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadWarehouses();
  }

  canDeleteWarehouse(warehouse: Warehouse): boolean {
    return warehouse.role === 'administrator';
  }

  roleLabel(role: Warehouse['role']): string {
    return role === 'administrator' ? 'Administrador' : 'Contribuidor';
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
        this.notificationService.success('Warehouse creado correctamente.');
        this.loadWarehouses();
        this.router.navigateByUrl('/app/home');
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo crear el warehouse.';
        this.notificationService.error(this.errorMessage);
      },
    });
  }

  openWarehouse(warehouseId: string): void {
    this.warehouseService.setSelectedWarehouseId(warehouseId);
    this.router.navigateByUrl('/app/home');
  }

  confirmDeleteWarehouse(warehouse: Warehouse): void {
    if (!this.isOnline) {
      this.notificationService.error('Necesitas conexión a internet para eliminar un almacén.');
      return;
    }

    const dialogRef = this.dialog.open<WarehouseDeleteDialogComponent, WarehouseDeleteDialogData, boolean>(
      WarehouseDeleteDialogComponent,
      {
        width: '520px',
        data: { warehouseName: warehouse.name },
      }
    );

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }
      this.deleteWarehouse(warehouse);
    });
  }

  private deleteWarehouse(warehouse: Warehouse): void {
    this.deletingWarehouseId = warehouse.id;
    this.errorMessage = '';

    this.warehouseService.delete(warehouse.id, warehouse.name).subscribe({
      next: async () => {
        this.deletingWarehouseId = null;
        if (this.warehouseService.getSelectedWarehouseId() === warehouse.id) {
          this.warehouseService.clearSelectedWarehouseId();
        }
        await this.syncService.purgeWarehouse(warehouse.id);
        this.notificationService.success('Almacén eliminado correctamente.');
        this.loadWarehouses();
      },
      error: (error: HttpErrorResponse) => {
        this.deletingWarehouseId = null;
        this.errorMessage = this.mapDeleteError(error);
        this.notificationService.error(this.errorMessage);
      },
    });
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

    this.warehouseService.createInvite(warehouseId, {
      email,
      role: this.inviteForm.controls.role.value,
    }).subscribe({
      next: (invite) => {
        this.inviteLoading = false;
        this.inviteLink = invite.invite_url;
        this.inviteToken = invite.invite_token;
        this.inviteMessage = invite.email_delivery_message;
        if (invite.email_delivery_status === 'sent') {
          this.notificationService.success(this.inviteMessage);
        } else {
          this.notificationService.info(this.inviteMessage);
        }
      },
      error: () => {
        this.inviteLoading = false;
        this.inviteError = 'No se pudo crear la invitación.';
        this.notificationService.error(this.inviteError);
      },
    });
  }

  private loadWarehouses(): void {
    this.warehouseService.list().subscribe({
      next: (warehouses) => {
        this.warehouses = warehouses;
        const selectedInviteWarehouse = this.inviteForm.controls.warehouseId.value;
        const selectedStillAllowed = this.administratorWarehouses.some(
          (warehouse) => warehouse.id === selectedInviteWarehouse
        );
        if (!selectedStillAllowed) {
          this.inviteForm.patchValue({
            warehouseId: this.administratorWarehouses[0]?.id ?? '',
          });
        }
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar los warehouses.';
        this.notificationService.error(this.errorMessage);
      },
    });
  }

  private mapDeleteError(error: HttpErrorResponse): string {
    const detail = typeof error.error?.detail === 'string' ? error.error.detail : '';
    switch (detail) {
      case 'Confirmation name does not match warehouse name':
        return 'El nombre de confirmación no coincide.';
      case 'Administrator role required':
        return 'Necesitas el rol Administrador para eliminar el almacén.';
      case 'Cannot delete warehouse while intake batches are processing':
        return 'No se puede eliminar mientras hay lotes en procesamiento.';
      case 'Warehouse deletion failed':
        return 'No se pudo eliminar el almacén. Inténtalo de nuevo.';
      default:
        return 'No se pudo eliminar el almacén.';
    }
  }
}
