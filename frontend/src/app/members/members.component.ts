import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';
import {
  WarehouseMember,
  WarehouseRole,
  WarehouseService,
} from '../services/warehouse.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
  ],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Miembros y roles</h1>
          <p class="page-subtitle">Gestiona el acceso al warehouse seleccionado</p>
        </div>
      </header>

      <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>

      <mat-card class="surface-card">
        <mat-card-content>
          <h2 class="card-title">Miembros</h2>
          <p class="card-subtitle">Debe existir al menos un Administrador en todo momento.</p>

          <div class="members-grid" *ngIf="members.length; else emptyMembers">
            <div class="item-card member-card" *ngFor="let member of members">
              <div class="member-identity">
                <mat-icon>person</mat-icon>
                <div>
                  <p class="item-card-title">{{ member.display_name || member.email }}</p>
                  <p class="item-card-meta">{{ member.email }}</p>
                </div>
              </div>
              <div class="member-role-actions">
                <mat-form-field>
                  <mat-label>Rol</mat-label>
                  <mat-select
                    [value]="pendingRoles[member.user_id] || member.role"
                    (selectionChange)="setPendingRole(member.user_id, $event.value)"
                    [disabled]="savingUserId === member.user_id || removingUserId === member.user_id"
                  >
                    <mat-option value="administrator">Administrador</mat-option>
                    <mat-option value="contributor">Contribuidor</mat-option>
                  </mat-select>
                </mat-form-field>
                <button
                  mat-flat-button
                  color="primary"
                  type="button"
                  [disabled]="!hasRoleChanged(member) || savingUserId === member.user_id || removingUserId === member.user_id"
                  (click)="saveRole(member)"
                >
                  {{ savingUserId === member.user_id ? 'Guardando...' : 'Guardar rol' }}
                </button>
                <button
                  mat-stroked-button
                  color="warn"
                  type="button"
                  *ngIf="canRemoveMember(member)"
                  [attr.aria-label]="'Retirar a ' + memberLabel(member)"
                  [disabled]="savingUserId === member.user_id || removingUserId === member.user_id"
                  (click)="removeMember(member)"
                >
                  <mat-icon>person_remove</mat-icon>
                  {{ removingUserId === member.user_id ? 'Retirando...' : 'Retirar' }}
                </button>
              </div>
            </div>
          </div>
          <ng-template #emptyMembers>
            <div class="empty-state">No se encontraron miembros.</div>
          </ng-template>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card permissions-card">
        <mat-card-content>
          <h2 class="card-title">Permisos efectivos</h2>
          <p class="card-subtitle">Los permisos son fijos por rol y no admiten excepciones individuales.</p>
          <div class="permissions-table-wrap">
            <table class="permissions-table">
              <thead>
                <tr><th>Capacidad</th><th>Administrador</th><th>Contribuidor</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let permission of permissions">
                  <td>{{ permission.label }}</td>
                  <td><mat-icon aria-label="Permitido">check_circle</mat-icon></td>
                  <td>
                    <mat-icon [attr.aria-label]="permission.contributor ? 'Permitido' : 'Denegado'">
                      {{ permission.contributor ? 'check_circle' : 'block' }}
                    </mat-icon>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .members-grid { display: grid; gap: 12px; margin-top: 16px; }
    .member-card, .member-identity, .member-role-actions { display: flex; align-items: center; gap: 12px; }
    .member-card { justify-content: space-between; flex-wrap: wrap; }
    .member-role-actions { flex-wrap: wrap; }
    .member-role-actions mat-form-field { min-width: 190px; }
    .permissions-card { margin-top: 16px; }
    .permissions-table-wrap { overflow-x: auto; margin-top: 16px; }
    .permissions-table { width: 100%; border-collapse: collapse; min-width: 520px; }
    .permissions-table th, .permissions-table td { padding: 12px; border-bottom: 1px solid var(--border); text-align: left; }
    .permissions-table th:not(:first-child), .permissions-table td:not(:first-child) { text-align: center; }
    .permissions-table mat-icon { color: var(--primary); }
    @media (max-width: 600px) {
      .member-card, .member-role-actions { align-items: stretch; flex-direction: column; }
      .member-role-actions mat-form-field, .member-role-actions button { width: 100%; }
    }
  `],
})
export class MembersComponent implements OnInit {
  members: WarehouseMember[] = [];
  pendingRoles: Record<string, WarehouseRole> = {};
  savingUserId: string | null = null;
  removingUserId: string | null = null;
  errorMessage = '';

  readonly permissions = [
    { label: 'Gestionar inventario, cajas y lotes', contributor: true },
    { label: 'Buscar, consultar actividad y usar QR', contributor: true },
    { label: 'Invitar personas y asignar roles', contributor: false },
    { label: 'Gestionar miembros, roles y accesos', contributor: false },
    { label: 'Acceder a Configuración, sync y backups', contributor: false },
    { label: 'Eliminar el warehouse', contributor: false },
  ];

  constructor(
    private readonly authService: AuthService,
    private readonly warehouseService: WarehouseService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadMembers();
  }

  setPendingRole(userId: string, role: WarehouseRole): void {
    this.pendingRoles[userId] = role;
  }

  hasRoleChanged(member: WarehouseMember): boolean {
    return !!this.pendingRoles[member.user_id] && this.pendingRoles[member.user_id] !== member.role;
  }

  canRemoveMember(member: WarehouseMember): boolean {
    const currentUserId = this.authService.currentUser()?.id;
    return !!currentUserId && member.user_id !== currentUserId;
  }

  memberLabel(member: WarehouseMember): string {
    return member.display_name?.trim() || member.email;
  }

  removeMember(member: WarehouseMember): void {
    const warehouseId = this.warehouseService.getSelectedWarehouseId();
    if (!warehouseId || !this.canRemoveMember(member)) {
      return;
    }
    const label = this.memberLabel(member);
    const confirmed = window.confirm(
      `¿Retirar a ${label} de este warehouse? Perderá el acceso inmediatamente.`
    );
    if (!confirmed) {
      return;
    }

    this.removingUserId = member.user_id;
    this.errorMessage = '';
    this.warehouseService.removeMember(warehouseId, member.user_id).subscribe({
      next: () => {
        this.removingUserId = null;
        this.members = this.members.filter((candidate) => candidate.user_id !== member.user_id);
        delete this.pendingRoles[member.user_id];
        this.notificationService.success('Miembro retirado correctamente.');
      },
      error: (error: HttpErrorResponse) => {
        this.removingUserId = null;
        if (error.status === 404) {
          this.errorMessage = 'El miembro ya no pertenece al warehouse.';
        } else if (error.status === 409) {
          this.errorMessage = 'No puedes retirar tu propia membresía.';
        } else {
          this.errorMessage = 'No se pudo retirar al miembro.';
        }
        this.notificationService.error(this.errorMessage);
      },
    });
  }

  saveRole(member: WarehouseMember): void {
    const warehouseId = this.warehouseService.getSelectedWarehouseId();
    const role = this.pendingRoles[member.user_id];
    if (!warehouseId || !role || role === member.role) {
      return;
    }

    this.savingUserId = member.user_id;
    this.errorMessage = '';
    this.warehouseService.updateMemberRole(warehouseId, member.user_id, role).subscribe({
      next: (updated) => {
        this.savingUserId = null;
        this.members = this.members.map((candidate) =>
          candidate.user_id === updated.user_id ? updated : candidate
        );
        delete this.pendingRoles[member.user_id];
        this.notificationService.success('Rol actualizado correctamente.');
        this.warehouseService.list().subscribe({ error: () => undefined });
      },
      error: (error: HttpErrorResponse) => {
        this.savingUserId = null;
        this.errorMessage = error.status === 409
          ? 'El warehouse debe conservar al menos un Administrador.'
          : 'No se pudo actualizar el rol.';
        this.notificationService.error(this.errorMessage);
      },
    });
  }

  private loadMembers(): void {
    const warehouseId = this.warehouseService.getSelectedWarehouseId();
    if (!warehouseId) {
      this.errorMessage = 'No hay un warehouse seleccionado.';
      return;
    }
    this.warehouseService.members(warehouseId).subscribe({
      next: (members) => {
        this.members = members;
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar los miembros.';
      },
    });
  }
}
