import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-reset-password',
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
        <mat-card-title>Nueva contraseña</mat-card-title>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field class="full-width">
              <mat-label>Token</mat-label>
              <input matInput formControlName="token" />
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>Nueva contraseña</mat-label>
              <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
            </mat-form-field>
            <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
            <div *ngIf="message">{{ message }}</div>
            <button class="full-width" mat-flat-button color="primary" [disabled]="loading || form.invalid">
              {{ loading ? 'Guardando...' : 'Cambiar contraseña' }}
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
export class ResetPasswordComponent {
  loading = false;
  message = '';
  errorMessage = '';

  readonly form = this.fb.nonNullable.group({
    token: ['', [Validators.required, Validators.minLength(10)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.form.controls.token.setValue(token);
    }
  }

  submit(): void {
    if (this.form.invalid || this.loading) {
      return;
    }

    this.loading = true;
    this.message = '';
    this.errorMessage = '';

    const raw = this.form.getRawValue();
    this.authService.resetPassword(raw.token, raw.newPassword).subscribe({
      next: (res) => {
        this.loading = false;
        this.message = res.message;
        setTimeout(() => this.router.navigateByUrl('/login'), 900);
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Token inválido o expirado.';
      }
    });
  }
}
