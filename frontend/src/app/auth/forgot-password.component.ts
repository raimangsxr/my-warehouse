import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

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
    MatInputModule
  ],
  template: `
    <div class="page">
      <mat-card>
        <mat-card-title>Recuperar contraseña</mat-card-title>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field class="full-width">
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" autocomplete="email" />
            </mat-form-field>
            <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
            <div *ngIf="message">{{ message }}</div>
            <div *ngIf="devToken"><strong>Token dev:</strong> {{ devToken }}</div>
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
