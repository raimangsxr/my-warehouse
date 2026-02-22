import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="page">
      <mat-card>
        <mat-card-title>Seguridad</mat-card-title>
        <mat-card-content>
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
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class SettingsComponent {
  passwordLoading = false;
  passwordError = '';
  passwordMessage = '';

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(8)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService
  ) {}

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
}
