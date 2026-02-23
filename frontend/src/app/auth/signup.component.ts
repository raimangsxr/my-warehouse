import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signup',
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
          <h1>Crea tu espacio de inventario</h1>
          <p>
            Configura warehouses compartidos y mantén control del contenido por cajas con trazabilidad de stock.
          </p>
        </section>

        <mat-card class="auth-card">
          <mat-card-header>
            <mat-card-title>Crear cuenta</mat-card-title>
            <mat-card-subtitle>Empieza en menos de un minuto</mat-card-subtitle>
          </mat-card-header>
          <mat-progress-bar *ngIf="loading" mode="indeterminate" />
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="submit()" class="form-stack">
              <mat-form-field class="full-width">
                <mat-label>Email</mat-label>
                <mat-icon matPrefix>mail</mat-icon>
                <input matInput formControlName="email" autocomplete="email" />
              </mat-form-field>

              <mat-form-field class="full-width">
                <mat-label>Password</mat-label>
                <mat-icon matPrefix>lock</mat-icon>
                <input matInput type="password" formControlName="password" autocomplete="new-password" />
              </mat-form-field>

              <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>

              <button class="full-width" mat-flat-button color="primary" [disabled]="loading || form.invalid">
                {{ loading ? 'Creando cuenta...' : 'Registrarme' }}
              </button>
            </form>
          </mat-card-content>
          <mat-card-actions>
            <a mat-button routerLink="/login">Ya tengo cuenta</a>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `
})
export class SignupComponent {
  loading = false;
  errorMessage = '';

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  submit(): void {
    if (this.form.invalid || this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const raw = this.form.getRawValue();
    this.authService.signup(raw).subscribe({
      next: () => {
        this.authService.login(raw).subscribe({
          next: () => {
            this.loading = false;
            this.router.navigateByUrl('/warehouses');
          },
          error: () => {
            this.loading = false;
            this.router.navigateByUrl('/login');
          }
        });
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo crear la cuenta.';
      }
    });
  }
}
