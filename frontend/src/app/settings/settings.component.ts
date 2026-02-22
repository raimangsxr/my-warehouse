import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AuthService } from '../services/auth.service';
import { SettingsService } from '../services/settings.service';
import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatCheckboxModule
  ],
  template: `
    <div class="page-wide">
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

      <mat-card style="margin-top: 16px">
        <mat-card-title>Email SMTP</mat-card-title>
        <mat-card-content>
          <form [formGroup]="smtpForm" (ngSubmit)="saveSmtp()">
            <mat-form-field class="full-width">
              <mat-label>Host</mat-label>
              <input matInput formControlName="host" />
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>Puerto</mat-label>
              <input matInput type="number" formControlName="port" />
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>Usuario</mat-label>
              <input matInput formControlName="username" />
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>Password (dejar vacío para mantener)</mat-label>
              <input matInput type="password" formControlName="password" />
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>Encriptación</mat-label>
              <mat-select formControlName="encryptionMode">
                <mat-option value="starttls">STARTTLS</mat-option>
                <mat-option value="ssl">SSL</mat-option>
                <mat-option value="none">Ninguna</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>From address</mat-label>
              <input matInput formControlName="fromAddress" />
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>From name</mat-label>
              <input matInput formControlName="fromName" />
            </mat-form-field>
            <div *ngIf="smtpPasswordMasked" class="muted">Password actual: {{ smtpPasswordMasked }}</div>
            <div class="row gap" style="margin-top: 8px">
              <button mat-flat-button color="primary" [disabled]="smtpForm.invalid || smtpLoading">
                {{ smtpLoading ? 'Guardando...' : 'Guardar SMTP' }}
              </button>
              <button mat-stroked-button type="button" (click)="testSmtp()" [disabled]="!smtpTestEmail.trim()">
                Test SMTP
              </button>
            </div>
            <mat-form-field class="full-width" style="margin-top: 8px">
              <mat-label>Email destino para test</mat-label>
              <input matInput [(ngModel)]="smtpTestEmail" [ngModelOptions]="{standalone: true}" />
            </mat-form-field>
            <div class="error" *ngIf="smtpError">{{ smtpError }}</div>
            <div *ngIf="smtpMessage">{{ smtpMessage }}</div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card style="margin-top: 16px">
        <mat-card-title>LLM (Gemini)</mat-card-title>
        <mat-card-content>
          <form [formGroup]="llmForm" (ngSubmit)="saveLlm()">
            <mat-form-field class="full-width">
              <mat-label>Provider</mat-label>
              <input matInput formControlName="provider" />
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>API key (dejar vacío para mantener)</mat-label>
              <input matInput type="password" formControlName="apiKey" />
            </mat-form-field>
            <mat-checkbox formControlName="autoTagsEnabled">Auto-tags</mat-checkbox>
            <mat-checkbox formControlName="autoAliasEnabled">Auto-alias</mat-checkbox>
            <div *ngIf="llmApiKeyMasked" class="muted">API key actual: {{ llmApiKeyMasked }}</div>
            <div class="row gap" style="margin-top: 8px">
              <button mat-flat-button color="primary" [disabled]="llmLoading">
                {{ llmLoading ? 'Guardando...' : 'Guardar LLM' }}
              </button>
            </div>
            <div class="error" *ngIf="llmError">{{ llmError }}</div>
            <div *ngIf="llmMessage">{{ llmMessage }}</div>
          </form>

          <h3 style="margin-top: 16px">Reprocesar tags/alias de artículo</h3>
          <div class="row gap">
            <mat-form-field class="grow">
              <mat-label>Item ID</mat-label>
              <input matInput [(ngModel)]="reprocessItemId" [ngModelOptions]="{standalone: true}" />
            </mat-form-field>
            <button mat-stroked-button type="button" (click)="reprocessItem()" [disabled]="!reprocessItemId.trim()">
              Reprocesar
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class SettingsComponent {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();

  passwordLoading = false;
  passwordError = '';
  passwordMessage = '';
  smtpLoading = false;
  smtpError = '';
  smtpMessage = '';
  smtpPasswordMasked: string | null = null;
  smtpTestEmail = '';
  llmLoading = false;
  llmError = '';
  llmMessage = '';
  llmApiKeyMasked: string | null = null;
  reprocessItemId = '';

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(8)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]]
  });
  readonly smtpForm = this.fb.nonNullable.group({
    host: ['', [Validators.required]],
    port: [587, [Validators.required]],
    username: [''],
    password: [''],
    encryptionMode: ['starttls', [Validators.required]],
    fromAddress: ['', [Validators.required]],
    fromName: ['']
  });
  readonly llmForm = this.fb.nonNullable.group({
    provider: ['gemini', [Validators.required]],
    apiKey: [''],
    autoTagsEnabled: true,
    autoAliasEnabled: true
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly settingsService: SettingsService,
    private readonly warehouseService: WarehouseService
  ) {
    this.loadSettings();
  }

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

  saveSmtp(): void {
    if (!this.selectedWarehouseId || this.smtpForm.invalid || this.smtpLoading) {
      return;
    }
    this.smtpLoading = true;
    this.smtpError = '';
    this.smtpMessage = '';
    const raw = this.smtpForm.getRawValue();
    this.settingsService
      .updateSmtpSettings(this.selectedWarehouseId, {
        host: raw.host.trim(),
        port: Number(raw.port),
        username: raw.username || null,
        password: raw.password || null,
        encryption_mode: raw.encryptionMode,
        from_address: raw.fromAddress.trim(),
        from_name: raw.fromName || null
      })
      .subscribe({
        next: (res) => {
          this.smtpLoading = false;
          this.smtpMessage = 'SMTP guardado.';
          this.smtpPasswordMasked = res.password_masked;
          this.smtpForm.patchValue({ password: '' });
        },
        error: () => {
          this.smtpLoading = false;
          this.smtpError = 'No se pudo guardar SMTP.';
        }
      });
  }

  testSmtp(): void {
    if (!this.selectedWarehouseId || !this.smtpTestEmail.trim()) {
      return;
    }
    this.settingsService.testSmtpSettings(this.selectedWarehouseId, this.smtpTestEmail.trim()).subscribe({
      next: (res) => {
        this.smtpMessage = res.message;
      },
      error: () => {
        this.smtpError = 'No se pudo ejecutar test SMTP.';
      }
    });
  }

  saveLlm(): void {
    if (!this.selectedWarehouseId || this.llmLoading) {
      return;
    }
    this.llmLoading = true;
    this.llmError = '';
    this.llmMessage = '';
    const raw = this.llmForm.getRawValue();
    this.settingsService
      .updateLlmSettings(this.selectedWarehouseId, {
        provider: raw.provider.trim(),
        api_key: raw.apiKey || null,
        auto_tags_enabled: raw.autoTagsEnabled,
        auto_alias_enabled: raw.autoAliasEnabled
      })
      .subscribe({
        next: (res) => {
          this.llmLoading = false;
          this.llmMessage = 'LLM guardado.';
          this.llmApiKeyMasked = res.api_key_masked;
          this.llmForm.patchValue({ apiKey: '' });
        },
        error: () => {
          this.llmLoading = false;
          this.llmError = 'No se pudo guardar LLM.';
        }
      });
  }

  reprocessItem(): void {
    if (!this.selectedWarehouseId || !this.reprocessItemId.trim()) {
      return;
    }
    this.settingsService.reprocessItem(this.selectedWarehouseId, this.reprocessItemId.trim()).subscribe({
      next: () => {
        this.llmMessage = 'Artículo reprocesado.';
      },
      error: () => {
        this.llmError = 'No se pudo reprocesar el artículo.';
      }
    });
  }

  private loadSettings(): void {
    if (!this.selectedWarehouseId) {
      return;
    }
    this.settingsService.getSmtpSettings(this.selectedWarehouseId).subscribe({
      next: (smtp) => {
        this.smtpForm.patchValue({
          host: smtp.host || '',
          port: smtp.port || 587,
          username: smtp.username || '',
          encryptionMode: smtp.encryption_mode || 'starttls',
          fromAddress: smtp.from_address || '',
          fromName: smtp.from_name || ''
        });
        this.smtpPasswordMasked = smtp.password_masked;
      }
    });
    this.settingsService.getLlmSettings(this.selectedWarehouseId).subscribe({
      next: (llm) => {
        this.llmForm.patchValue({
          provider: llm.provider,
          autoTagsEnabled: llm.auto_tags_enabled,
          autoAliasEnabled: llm.auto_alias_enabled
        });
        this.llmApiKeyMasked = llm.api_key_masked;
      }
    });
  }
}
