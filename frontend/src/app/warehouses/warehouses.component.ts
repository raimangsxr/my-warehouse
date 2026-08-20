import { HttpErrorResponse } from '@angular/common/http';
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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';

import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { SyncService } from '../services/sync.service';
import { WarehouseOverview, WarehouseService } from '../services/warehouse.service';
import { WarehouseDeleteDialogComponent, WarehouseDeleteDialogData } from './warehouse-delete-dialog.component';

@Component({
  selector: 'app-warehouses',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  template: `
    <div class="app-page warehouses-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Tus warehouses</h1>
          <p class="page-subtitle">Cambia de espacio o elige dónde quieres entrar por defecto</p>
        </div>
      </header>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="loadingOverview" mode="indeterminate" />
        <mat-card-content>
          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
          <div class="warehouse-grid" *ngIf="warehouses.length; else emptyWarehouses">
            <article class="warehouse-card" *ngFor="let warehouse of warehouses">
              <div class="warehouse-heading">
                <mat-icon>warehouse</mat-icon>
                <div class="grow">
                  <h2>{{ warehouse.name }}</h2>
                  <div class="warehouse-badges">
                    <span class="inline-chip">{{ roleLabel(warehouse.role) }}</span>
                    <span class="inline-chip active-chip" *ngIf="isActive(warehouse)">Activo</span>
                    <span class="inline-chip default-chip" *ngIf="isDefault(warehouse)">Predeterminado</span>
                  </div>
                </div>
              </div>

              <div class="metric-grid" aria-label="Resumen del warehouse">
                <div><strong>{{ warehouse.active_item_count ?? 0 }}</strong><span>Artículos</span></div>
                <div><strong>{{ warehouse.stock_unit_count ?? 0 }}</strong><span>Unidades</span></div>
                <div><strong>{{ warehouse.active_box_count ?? 0 }}</strong><span>Cajas</span></div>
                <div><strong>{{ warehouse.open_batch_count ?? 0 }}</strong><span>Lotes abiertos</span></div>
              </div>

              <section class="members-summary">
                <div class="members-title"><strong>Acceso</strong><span>{{ warehouse.member_count ?? 0 }} miembros</span></div>
                <div class="member-row" *ngFor="let member of warehouse.members || []">
                  <mat-icon>person</mat-icon>
                  <span class="grow">
                    {{ member.display_name || member.email || 'Usuario' }}
                    <small *ngIf="member.email && member.display_name">{{ member.email }}</small>
                  </span>
                  <span class="inline-chip">{{ roleLabel(member.role) }}</span>
                </div>
              </section>

              <div class="warehouse-actions">
                <button mat-flat-button color="primary" type="button" (click)="openWarehouse(warehouse.id)" [disabled]="isActive(warehouse)">
                  {{ isActive(warehouse) ? 'Abierto' : 'Abrir' }}
                </button>
                <button mat-stroked-button type="button" (click)="markDefault(warehouse)" [disabled]="isDefault(warehouse) || settingDefaultId === warehouse.id">
                  <mat-icon>star</mat-icon>{{ isDefault(warehouse) ? 'Predeterminado' : 'Marcar por defecto' }}
                </button>
                <button mat-stroked-button color="warn" type="button" *ngIf="warehouse.role === 'administrator'" [disabled]="!isOnline || deletingWarehouseId === warehouse.id" (click)="confirmDeleteWarehouse(warehouse)">
                  Eliminar
                </button>
              </div>
            </article>
          </div>
          <ng-template #emptyWarehouses>
            <div class="empty-state">No tienes warehouses todavía. Crea el primero para empezar.</div>
          </ng-template>
        </mat-card-content>
      </mat-card>

      <div class="management-grid" *ngIf="canCreateWarehouse() || administratorWarehouses.length">
        <mat-card class="surface-card" *ngIf="canCreateWarehouse()">
          <mat-card-content>
            <h2 class="card-title">Crear warehouse</h2>
            <p class="card-subtitle">Serás Administrador del nuevo espacio</p>
            <form [formGroup]="form" (ngSubmit)="createWarehouse()" class="form-stack mt-10">
              <mat-form-field class="full-width"><mat-label>Nombre</mat-label><mat-icon matPrefix>inventory_2</mat-icon><input matInput formControlName="name" /></mat-form-field>
              <button mat-flat-button color="primary" [disabled]="loading || form.invalid">{{ loading ? 'Creando...' : 'Crear warehouse' }}</button>
            </form>
          </mat-card-content>
        </mat-card>

        <mat-card class="surface-card" *ngIf="administratorWarehouses.length">
          <mat-card-content>
            <h2 class="card-title">Invitar miembro</h2>
            <p class="card-subtitle">Solo puedes invitar a warehouses que administras</p>
            <form [formGroup]="inviteForm" (ngSubmit)="createInvite()" class="form-stack mt-10">
              <mat-form-field class="full-width"><mat-label>Warehouse</mat-label><mat-select formControlName="warehouseId"><mat-option *ngFor="let warehouse of administratorWarehouses" [value]="warehouse.id">{{ warehouse.name }}</mat-option></mat-select></mat-form-field>
              <mat-form-field class="full-width"><mat-label>Email (opcional)</mat-label><mat-icon matPrefix>mail</mat-icon><input matInput formControlName="email" /></mat-form-field>
              <mat-form-field class="full-width"><mat-label>Rol</mat-label><mat-select formControlName="role"><mat-option value="contributor">Contribuidor</mat-option><mat-option value="administrator">Administrador</mat-option></mat-select></mat-form-field>
              <button mat-stroked-button color="primary" type="submit" [disabled]="inviteForm.invalid || inviteLoading">{{ inviteLoading ? 'Generando...' : 'Generar invitación' }}</button>
            </form>
            <div class="error mt-8" *ngIf="inviteError">{{ inviteError }}</div>
            <div class="status-message mt-8" *ngIf="inviteMessage">{{ inviteMessage }}</div>
            <div class="item-card invite-link-card mt-10" *ngIf="inviteLink"><div class="status-line"><strong>Link:</strong> {{ inviteLink }}</div><div class="status-line"><strong>Token:</strong> {{ inviteToken }}</div></div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .warehouses-page { display: grid; gap: 14px; }
    .warehouses-page .page-header { margin-bottom: 2px; }
    .warehouse-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 14px; }
    .warehouse-card { display: grid; align-content: start; gap: 14px; padding: 16px; border: 1px solid var(--border-soft); border-radius: 14px; background: #fff; box-shadow: 0 4px 14px rgba(31, 41, 55, .06); }
    .warehouse-heading { display: flex; align-items: flex-start; gap: 10px; }
    .warehouse-heading h2 { margin: 0 0 6px; font-size: 1.05rem; }
    .warehouse-badges, .warehouse-actions { display: flex; flex-wrap: wrap; gap: 7px; }
    .active-chip { color: #0d47a1; background: #e8f1ff; }
    .default-chip { color: #7a5200; background: #fff5d8; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
    .metric-grid div { display: grid; gap: 2px; text-align: center; padding: 9px 4px; border-radius: 10px; background: var(--surface-2); }
    .metric-grid strong { font-size: 1.05rem; }
    .metric-grid span { font-size: .72rem; color: var(--text-2); }
    .members-summary { display: grid; gap: 7px; }
    .members-title, .member-row { display: flex; align-items: center; gap: 8px; }
    .members-title { justify-content: space-between; color: var(--text-2); font-size: .84rem; }
    .member-row { min-width: 0; font-size: .86rem; }
    .member-row mat-icon { color: var(--text-3); font-size: 18px; width: 18px; height: 18px; }
    .member-row small { display: block; color: var(--text-3); overflow-wrap: anywhere; }
    .management-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 14px; }
    .invite-link-card { overflow-wrap: anywhere; }
    @media (max-width: 440px) { .metric-grid { grid-template-columns: repeat(2, 1fr); } .warehouse-actions > button { flex: 1 1 100%; } }
  `]
})
export class WarehousesComponent implements OnInit {
  loading = false;
  loadingOverview = false;
  inviteLoading = false;
  deletingWarehouseId: string | null = null;
  settingDefaultId: string | null = null;
  errorMessage = '';
  inviteError = '';
  inviteMessage = '';
  inviteLink = '';
  inviteToken = '';
  warehouses: WarehouseOverview[] = [];
  readonly canCreateWarehouse = this.warehouseService.canCreateWarehouse;

  readonly form = this.fb.nonNullable.group({ name: ['', [Validators.required, Validators.maxLength(120)]] });
  readonly inviteForm = this.fb.group({
    warehouseId: ['', [Validators.required]],
    email: ['', [Validators.email]],
    role: this.fb.nonNullable.control<'administrator' | 'contributor'>('contributor'),
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly warehouseService: WarehouseService,
    private readonly authService: AuthService,
    private readonly syncService: SyncService,
    private readonly dialog: MatDialog,
    private readonly router: Router,
    private readonly notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    if (!this.authService.currentUser()) this.authService.me().subscribe({ error: () => undefined });
    this.loadWarehouses();
  }

  get administratorWarehouses(): WarehouseOverview[] { return this.warehouses.filter((warehouse) => warehouse.role === 'administrator'); }
  get isOnline(): boolean { return this.syncService.isOnline(); }
  roleLabel(role: WarehouseOverview['role']): string { return role === 'administrator' ? 'Administrador' : 'Contribuidor'; }
  canDeleteWarehouse(warehouse: WarehouseOverview): boolean { return warehouse.role === 'administrator'; }
  isActive(warehouse: WarehouseOverview): boolean { return warehouse.id === this.warehouseService.selectedWarehouseId(); }
  isDefault(warehouse: WarehouseOverview): boolean { return warehouse.id === this.authService.currentUser()?.default_warehouse_id; }

  createWarehouse(): void {
    if (this.form.invalid || this.loading) return;
    this.loading = true;
    this.errorMessage = '';
    this.warehouseService.create(this.form.controls.name.value).subscribe({
      next: (warehouse) => {
        this.loading = false;
        this.form.reset();
        this.warehouseService.setSelectedWarehouseId(warehouse.id);
        this.authService.me().subscribe({ error: () => undefined });
        this.notificationService.success('Warehouse creado correctamente.');
        this.router.navigateByUrl('/app/home');
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = error.status === 403 ? 'Solo un Administrador puede crear más warehouses.' : 'No se pudo crear el warehouse.';
        this.notificationService.error(this.errorMessage);
      },
    });
  }

  openWarehouse(warehouseId: string): void {
    this.warehouseService.setSelectedWarehouseId(warehouseId);
    this.router.navigateByUrl('/app/home');
  }

  markDefault(warehouse: WarehouseOverview): void {
    if (this.isDefault(warehouse)) return;
    this.settingDefaultId = warehouse.id;
    this.authService.setDefaultWarehouse(warehouse.id).subscribe({
      next: () => { this.settingDefaultId = null; this.notificationService.success(`${warehouse.name} es ahora tu warehouse predeterminado.`); },
      error: () => { this.settingDefaultId = null; this.notificationService.error('No se pudo cambiar el warehouse predeterminado.'); },
    });
  }

  confirmDeleteWarehouse(warehouse: WarehouseOverview): void {
    if (!this.isOnline) { this.notificationService.error('Necesitas conexión a internet para eliminar un almacén.'); return; }
    this.dialog.open<WarehouseDeleteDialogComponent, WarehouseDeleteDialogData, boolean>(WarehouseDeleteDialogComponent, { width: '520px', data: { warehouseName: warehouse.name } }).afterClosed().subscribe((confirmed) => {
      if (confirmed) this.deleteWarehouse(warehouse);
    });
  }

  createInvite(): void {
    if (this.inviteForm.invalid || this.inviteLoading) return;
    const warehouseId = this.inviteForm.controls.warehouseId.value;
    if (!warehouseId) return;
    this.inviteLoading = true;
    this.inviteError = '';
    this.inviteMessage = '';
    this.warehouseService.createInvite(warehouseId, {
      email: this.inviteForm.controls.email.value?.trim() || null,
      role: this.inviteForm.controls.role.value,
    }).subscribe({
      next: (invite) => {
        this.inviteLoading = false;
        this.inviteLink = invite.invite_url;
        this.inviteToken = invite.invite_token;
        this.inviteMessage = invite.email_delivery_message;
        invite.email_delivery_status === 'sent' ? this.notificationService.success(this.inviteMessage) : this.notificationService.info(this.inviteMessage);
      },
      error: () => { this.inviteLoading = false; this.inviteError = 'No se pudo crear la invitación.'; this.notificationService.error(this.inviteError); },
    });
  }

  private deleteWarehouse(warehouse: WarehouseOverview): void {
    this.deletingWarehouseId = warehouse.id;
    this.warehouseService.delete(warehouse.id, warehouse.name).subscribe({
      next: async () => {
        this.deletingWarehouseId = null;
        if (this.isActive(warehouse)) this.warehouseService.clearSelectedWarehouseId();
        await this.syncService.purgeWarehouse(warehouse.id);
        this.authService.me().subscribe({ error: () => undefined });
        this.notificationService.success('Almacén eliminado correctamente.');
        this.loadWarehouses();
      },
      error: (error: HttpErrorResponse) => { this.deletingWarehouseId = null; this.errorMessage = this.mapDeleteError(error); this.notificationService.error(this.errorMessage); },
    });
  }

  private loadWarehouses(): void {
    this.loadingOverview = true;
    this.warehouseService.overview().subscribe({
      next: (warehouses) => {
        this.loadingOverview = false;
        this.warehouses = warehouses;
        const selectedInvite = this.inviteForm.controls.warehouseId.value;
        if (!this.administratorWarehouses.some((warehouse) => warehouse.id === selectedInvite)) {
          this.inviteForm.patchValue({ warehouseId: this.administratorWarehouses[0]?.id ?? '' });
        }
      },
      error: () => { this.loadingOverview = false; this.errorMessage = 'No se pudieron cargar los warehouses.'; this.notificationService.error(this.errorMessage); },
    });
  }

  private mapDeleteError(error: HttpErrorResponse): string {
    const detail = typeof error.error?.detail === 'string' ? error.error.detail : '';
    if (detail === 'Confirmation name does not match warehouse name') return 'El nombre de confirmación no coincide.';
    if (detail === 'Cannot delete warehouse while intake batches are processing') return 'No se puede eliminar mientras hay lotes en procesamiento.';
    if (detail === 'Administrator role required') return 'Necesitas el rol Administrador para eliminar el almacén.';
    return 'No se pudo eliminar el almacén.';
  }
}
