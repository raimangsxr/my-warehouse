import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressBarModule
  ],
  template: `
    <div class="auth-layout">
      <div class="auth-shell">
        <section class="auth-panel">
          <h1>Recuperación segura</h1>
          <p>
            Introduce tu email para generar un enlace de recuperación. En desarrollo también verás el token para pruebas.
          </p>
        </section>

        <mat-card class="auth-card">
          <mat-card-header>
            <mat-card-title>Recuperar contraseña</mat-card-title>
            <mat-card-subtitle>Te enviaremos un enlace de restablecimiento</mat-card-subtitle>
          </mat-card-header>
          <mat-progress-bar *ngIf="loading" mode="indeterminate" />
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="submit()" class="form-stack">
              <mat-form-field class="full-width">
                <mat-label>Email</mat-label>
                <mat-icon matPrefix>mail</mat-icon>
                <input matInput formControlName="email" autocomplete="email" />
              </mat-form-field>

              <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
              <div class="status-message" *ngIf="message">{{ message }}</div>
              <div class="status-line" *ngIf="devToken"><strong>Token dev:</strong> {{ devToken }}</div>

              <button class="full-width" mat-flat-button color="primary" [disabled]="loading || form.invalid">
                {{ loading ? 'Generando...' : 'Generar enlace' }}
              </button>
            </form>
          </mat-card-content>
          <mat-card-actions>
            <a mat-button routerLink="/login">Volver a login</a>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {
  loading = false;
  message = '';
  errorMessage = '';
  devToken = '';

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required]]
  });

  constructor(private readonly fb: FormBuilder, private readonly authService: AuthService) {}

  submit(): void {
    if (this.form.invalid || this.loading) {
      return;
    }

    this.loading = true;
    this.message = '';
    this.errorMessage = '';
    this.devToken = '';

    this.authService.forgotPassword(this.form.controls.email.value).subscribe({
      next: (res) => {
        this.loading = false;
        this.message = res.message;
        this.devToken = res.reset_token ?? '';
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo procesar la solicitud.';
      }
    });
  }
}
