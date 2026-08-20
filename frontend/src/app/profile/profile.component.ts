import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { PwaService } from '../services/pwa.service';
import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="app-page profile-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Perfil</h1>
          <p class="page-subtitle">Tu cuenta, seguridad y versión de la aplicación</p>
        </div>
      </header>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="profileLoading" mode="indeterminate" />
        <mat-card-content>
          <h2 class="card-title">Datos personales</h2>
          <p class="card-subtitle">El email identifica tu cuenta y no se puede cambiar</p>
          <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="form-row mt-10">
            <mat-form-field>
              <mat-label>Nombre visible</mat-label>
              <mat-icon matPrefix>badge</mat-icon>
              <input matInput formControlName="displayName" maxlength="120" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Email</mat-label>
              <mat-icon matPrefix>mail</mat-icon>
              <input matInput formControlName="email" readonly />
            </mat-form-field>
            <div class="inline-actions">
              <button mat-flat-button color="primary" [disabled]="profileLoading || profileForm.invalid">
                Guardar perfil
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="passwordLoading" mode="indeterminate" />
        <mat-card-content>
          <h2 class="card-title">Seguridad</h2>
          <p class="card-subtitle">Actualiza tu contraseña de acceso</p>
          <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" class="form-row mt-10">
            <mat-form-field>
              <mat-label>Contraseña actual</mat-label>
              <mat-icon matPrefix>lock</mat-icon>
              <input matInput type="password" formControlName="currentPassword" autocomplete="current-password" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Nueva contraseña</mat-label>
              <mat-icon matPrefix>lock_reset</mat-icon>
              <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
            </mat-form-field>
            <div class="inline-actions">
              <button mat-flat-button color="primary" [disabled]="passwordLoading || passwordForm.invalid">
                {{ passwordLoading ? 'Guardando...' : 'Actualizar contraseña' }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-content>
          <h2 class="card-title">Aplicación</h2>
          <p class="card-subtitle">Instalación y actualizaciones</p>
          <div class="pwa-status-grid mt-10">
            <div class="item-card">
              <div class="status-line"><strong>Instalada:</strong> {{ pwaService.isInstalled() ? 'Sí' : 'No' }}</div>
              <div class="status-line"><strong>Versión instalada:</strong> {{ pwaService.currentVersionLabel() }}</div>
              <div class="status-line"><strong>Nueva versión detectada:</strong> {{ pwaService.latestVersionLabel() || 'No' }}</div>
              <div class="status-line"><strong>Última comprobación:</strong> {{ (pwaService.lastUpdateCheck() | date: 'short') || 'Todavía no realizada' }}</div>
            </div>
            <div class="pwa-hint-card" *ngIf="isAdministrator()">
              <div class="status-line"><strong>Service Worker:</strong> {{ pwaService.serviceWorkerEnabled() ? 'Activo' : 'Desactivado' }}</div>
              <div class="status-line"><strong>Prompt de instalación:</strong> {{ pwaService.canInstall() ? 'Disponible' : 'No disponible' }}</div>
              <div class="status-line"><strong>Actualización pendiente:</strong> {{ pwaService.updateAvailable() ? 'Sí' : 'No' }}</div>
              <p class="status-line" *ngIf="pwaService.lastUpdateError()">{{ pwaService.lastUpdateError() }}</p>
              <p class="status-line" *ngIf="pwaService.showIosInstallHint()">
                En iPhone/iPad usa Safari y toca <strong>Compartir</strong> → <strong>Añadir a pantalla de inicio</strong>.
              </p>
              <p class="status-line">La API autenticada no se almacena en la caché de la aplicación.</p>
            </div>
          </div>
          <div class="actions-mobile-full mt-10">
            <button mat-flat-button color="primary" type="button" *ngIf="pwaService.canInstall()" (click)="installApp()">
              Instalar app
            </button>
            <button mat-stroked-button type="button" (click)="checkForAppUpdate()">Buscar actualización</button>
            <button mat-stroked-button color="primary" type="button" *ngIf="pwaService.updateAvailable()" (click)="applyAppUpdate()">
              Aplicar actualización
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .profile-page { display: grid; gap: 14px; }
    .profile-page .page-header { margin-bottom: 2px; }
    .pwa-status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .pwa-hint-card { padding: 12px; border: 1px dashed var(--border-soft); border-radius: 12px; background: var(--surface-2); }
  `]
})
export class ProfileComponent implements OnInit {
  profileLoading = false;
  passwordLoading = false;
  readonly isAdministrator = this.warehouseService.isSelectedWarehouseAdministrator;

  readonly profileForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.maxLength(120)]],
    email: [''],
  });
  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(8)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly warehouseService: WarehouseService,
    private readonly notificationService: NotificationService,
    public readonly pwaService: PwaService,
  ) {}

  ngOnInit(): void {
    this.profileLoading = true;
    this.authService.me().subscribe({
      next: (user) => {
        this.profileLoading = false;
        this.profileForm.setValue({ displayName: user.display_name ?? '', email: user.email });
      },
      error: () => {
        this.profileLoading = false;
        this.notificationService.error('No se pudo cargar el perfil.');
      },
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.profileLoading) return;
    this.profileLoading = true;
    this.authService.updateProfile(this.profileForm.controls.displayName.value.trim() || null).subscribe({
      next: (user) => {
        this.profileLoading = false;
        this.profileForm.patchValue({ displayName: user.display_name ?? '', email: user.email });
        this.notificationService.success('Perfil actualizado correctamente.');
      },
      error: () => {
        this.profileLoading = false;
        this.notificationService.error('No se pudo actualizar el perfil.');
      },
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid || this.passwordLoading) return;
    this.passwordLoading = true;
    const value = this.passwordForm.getRawValue();
    this.authService.changePassword(value.currentPassword, value.newPassword).subscribe({
      next: () => {
        this.passwordLoading = false;
        this.passwordForm.reset();
        this.notificationService.success('Contraseña actualizada correctamente.');
      },
      error: () => {
        this.passwordLoading = false;
        this.notificationService.error('No se pudo actualizar la contraseña. Revisa la contraseña actual.');
      },
    });
  }

  async installApp(): Promise<void> {
    const result = await this.pwaService.promptInstall();
    if (result === 'accepted') this.notificationService.success('La instalación de la app se ha iniciado.');
    else if (result === 'dismissed') this.notificationService.info('La instalación se ha pospuesto.');
    else this.notificationService.info('La instalación no está disponible en este momento.');
  }

  async checkForAppUpdate(): Promise<void> {
    const available = await this.pwaService.checkForUpdate();
    if (available || this.pwaService.updateAvailable()) {
      this.notificationService.info(`Nueva versión detectada: ${this.pwaService.latestVersionLabel() || 'disponible'}.`);
    } else if (this.pwaService.lastUpdateError()) {
      this.notificationService.error(this.pwaService.lastUpdateError()!);
    } else {
      this.notificationService.info(`La app ya está actualizada en la versión ${this.pwaService.currentVersionLabel()}.`);
    }
  }

  async applyAppUpdate(): Promise<void> {
    const result = await this.pwaService.activateUpdate();
    if (result.status === 'none') this.notificationService.info('No hay actualizaciones pendientes.');
    if (result.status === 'error') this.notificationService.error(result.message);
  }
}
