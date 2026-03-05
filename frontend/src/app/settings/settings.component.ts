import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Subscription } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { GeminiModelId, SettingsService } from '../services/settings.service';
import { SyncService } from '../services/sync.service';
import { TransferService, WarehouseExportPayload } from '../services/transfer.service';
import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressBarModule
  ],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Configuración</h1>
          <p class="page-subtitle">Seguridad de cuenta, SMTP, LLM, Sync y backup/import</p>
        </div>
      </header>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="passwordLoading" mode="indeterminate" />
        <mat-card-content>
          <div class="card-header-row">
            <div>
              <h2 class="card-title">Seguridad</h2>
              <p class="card-subtitle">Actualiza tu contraseña de acceso</p>
            </div>
          </div>

          <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" class="form-row">
            <mat-form-field>
              <mat-label>Contraseña actual</mat-label>
              <mat-icon matPrefix>lock</mat-icon>
              <input matInput type="password" formControlName="currentPassword" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Nueva contraseña</mat-label>
              <mat-icon matPrefix>lock_reset</mat-icon>
              <input matInput type="password" formControlName="newPassword" />
            </mat-form-field>
            <div class="inline-actions">
              <button mat-flat-button color="primary" [disabled]="passwordForm.invalid || passwordLoading">
                {{ passwordLoading ? 'Guardando...' : 'Actualizar contraseña' }}
              </button>
            </div>
          </form>

          <div class="error" *ngIf="passwordError">{{ passwordError }}</div>
          <div class="status-message" *ngIf="passwordMessage">{{ passwordMessage }}</div>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="smtpLoading" mode="indeterminate" />
        <mat-card-content>
          <div class="card-header-row">
            <div>
              <h2 class="card-title">Email SMTP</h2>
              <p class="card-subtitle">Canal para invitaciones y recuperación de cuenta</p>
            </div>
          </div>

          <form [formGroup]="smtpForm" (ngSubmit)="saveSmtp()" class="form-stack">
            <div class="form-row">
              <mat-form-field>
                <mat-label>Host</mat-label>
                <input matInput formControlName="host" />
              </mat-form-field>
              <mat-form-field>
                <mat-label>Puerto</mat-label>
                <input matInput type="number" formControlName="port" />
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field>
                <mat-label>Usuario</mat-label>
                <input matInput formControlName="username" />
              </mat-form-field>
              <mat-form-field>
                <mat-label>Password (vacío para mantener)</mat-label>
                <input matInput type="password" formControlName="password" />
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field>
                <mat-label>Encriptación</mat-label>
                <mat-select formControlName="encryptionMode">
                  <mat-option value="starttls">STARTTLS</mat-option>
                  <mat-option value="ssl">SSL</mat-option>
                  <mat-option value="none">Ninguna</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field>
                <mat-label>From address</mat-label>
                <input matInput formControlName="fromAddress" />
              </mat-form-field>

              <mat-form-field>
                <mat-label>From name</mat-label>
                <input matInput formControlName="fromName" />
              </mat-form-field>
            </div>

            <div class="status-line" *ngIf="smtpPasswordMasked">Password actual: {{ smtpPasswordMasked }}</div>

            <div class="inline-actions">
              <button mat-flat-button color="primary" [disabled]="smtpForm.invalid || smtpLoading">
                {{ smtpLoading ? 'Guardando...' : 'Guardar SMTP' }}
              </button>
              <mat-form-field>
                <mat-label>Email destino para test</mat-label>
                <input matInput [(ngModel)]="smtpTestEmail" [ngModelOptions]="{ standalone: true }" />
              </mat-form-field>
              <button mat-stroked-button type="button" (click)="testSmtp()" [disabled]="!smtpTestEmail.trim()">
                Test SMTP
              </button>
            </div>
          </form>

          <div class="error" *ngIf="smtpError">{{ smtpError }}</div>
          <div class="status-message" *ngIf="smtpMessage">{{ smtpMessage }}</div>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="llmLoading" mode="indeterminate" />
        <mat-card-content>
          <div class="card-header-row">
            <div>
              <h2 class="card-title">LLM (Gemini)</h2>
              <p class="card-subtitle">Autogeneración de tags y alias en artículos</p>
            </div>
          </div>

          <form [formGroup]="llmForm" (ngSubmit)="saveLlm()" class="form-stack">
            <div class="form-row">
              <mat-form-field>
                <mat-label>Provider</mat-label>
                <mat-select formControlName="provider">
                  <mat-option value="gemini">Gemini</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field>
                <mat-label>Idioma de salida</mat-label>
                <mat-select formControlName="language">
                  <mat-option value="es">Español</mat-option>
                  <mat-option value="en">Inglés</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field>
                <mat-label>API key</mat-label>
                <input matInput [type]="llmApiKeyVisible ? 'text' : 'password'" formControlName="apiKey" />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="toggleLlmApiKeyVisibility()"
                  [attr.aria-label]="llmApiKeyVisible ? 'Ocultar API key' : 'Mostrar API key'"
                >
                  <mat-icon>{{ llmApiKeyVisible ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </mat-form-field>
            </div>

            <div class="inline-actions">
              <mat-checkbox formControlName="autoTagsEnabled">Auto-tags</mat-checkbox>
              <mat-checkbox formControlName="autoAliasEnabled">Auto-alias</mat-checkbox>
            </div>

            <div class="model-priority-section">
              <div class="model-priority-header">
                <strong>Orden de fallback de modelos</strong>
                <button mat-stroked-button type="button" (click)="resetModelPriority()" [disabled]="llmLoading">
                  Restablecer orden por defecto
                </button>
              </div>
              <p class="status-line">Si un modelo falla (RPM/TPM/RPD o error de request), se prueba el siguiente.</p>
              <div class="model-priority-list">
                <div class="model-priority-row" *ngFor="let modelId of llmModelPriority; let index = index">
                  <div class="model-priority-label">
                    <span class="priority-chip">{{ index + 1 }}</span>
                    <span>{{ getGeminiModelLabel(modelId) }}</span>
                  </div>
                  <div class="model-priority-actions">
                    <button
                      mat-icon-button
                      type="button"
                      (click)="moveModelPriority(index, -1)"
                      [disabled]="llmLoading || index === 0"
                      aria-label="Subir prioridad"
                    >
                      <mat-icon>arrow_upward</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      type="button"
                      (click)="moveModelPriority(index, 1)"
                      [disabled]="llmLoading || index === llmModelPriority.length - 1"
                      aria-label="Bajar prioridad"
                    >
                      <mat-icon>arrow_downward</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="inline-actions">
              <button mat-flat-button color="primary" [disabled]="llmLoading">
                {{ llmLoading ? 'Guardando...' : 'Guardar LLM' }}
              </button>
            </div>
          </form>

          <div class="error" *ngIf="llmError">{{ llmError }}</div>
          <div class="status-message" *ngIf="llmMessage">{{ llmMessage }}</div>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="syncLoading" mode="indeterminate" />
        <mat-card-content>
          <div class="card-header-row">
            <div>
              <h2 class="card-title">Offline + Sync</h2>
              <p class="card-subtitle">Estado de conexión, cola local y sincronización incremental</p>
            </div>
          </div>

          <div class="item-card">
            <div class="status-line"><strong>Conexión:</strong> {{ syncOnline ? 'Online' : 'Offline' }}</div>
            <div class="status-line"><strong>Comandos en cola:</strong> {{ syncQueueCount }}</div>
            <div class="status-line"><strong>Last seq:</strong> {{ syncLastSeq }}</div>
            <div class="status-line"><strong>Conflictos abiertos:</strong> {{ syncConflictsCount }}</div>
          </div>

          <div class="actions-mobile-full mt-10">
            <button mat-flat-button color="primary" type="button" (click)="forceSync()" [disabled]="syncLoading">
              Forzar sync
            </button>
            <button mat-stroked-button type="button" (click)="refreshSyncStatus()" [disabled]="syncLoading">
              Refrescar estado
            </button>
            <button mat-stroked-button routerLink="/app/conflicts" type="button">Ir a conflictos</button>
          </div>

          <div class="error" *ngIf="syncError">{{ syncError }}</div>
          <div class="status-message" *ngIf="syncMessage">{{ syncMessage }}</div>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-content>
          <div class="card-header-row">
            <div>
              <h2 class="card-title">Export / Import</h2>
              <p class="card-subtitle">Backup JSON e importación validada del warehouse actual</p>
            </div>
          </div>

          <div class="actions-mobile-full">
            <button mat-flat-button color="primary" type="button" (click)="exportWarehouse()">Exportar JSON</button>
            <input #importInput class="import-input" type="file" accept="application/json" (change)="importWarehouse($event)" />
          </div>

          <div class="error" *ngIf="transferError">{{ transferError }}</div>
          <div class="status-message" *ngIf="transferMessage">{{ transferMessage }}</div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .import-input {
        max-width: 100%;
      }

      .model-priority-section {
        display: grid;
        gap: 8px;
      }

      .model-priority-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
      }

      .model-priority-list {
        display: grid;
        gap: 6px;
      }

      .model-priority-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        border: 1px solid rgba(127, 127, 127, 0.25);
        border-radius: 10px;
      }

      .model-priority-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .model-priority-actions {
        display: inline-flex;
        align-items: center;
      }

      .priority-chip {
        display: inline-flex;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        background: rgba(25, 118, 210, 0.12);
        color: #0d47a1;
        flex-shrink: 0;
      }

      @media (max-width: 600px) {
        .import-input {
          width: 100%;
        }

        .model-priority-header {
          align-items: stretch;
        }
      }
    `
  ]
})
export class SettingsComponent implements OnInit, OnDestroy {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();
  readonly geminiModelCatalog: ReadonlyArray<{ id: GeminiModelId; label: string }> = [
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
    { id: 'gemini-3-flash', label: 'Gemini 3 Flash' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' }
  ];
  readonly defaultLlmModelPriority: GeminiModelId[] = this.geminiModelCatalog.map((model) => model.id);

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
  llmApiKeyVisible = false;
  llmModelPriority: GeminiModelId[] = [...this.defaultLlmModelPriority];

  syncLoading = false;
  syncMessage = '';
  syncError = '';
  syncOnline = true;
  syncQueueCount = 0;
  syncConflictsCount = 0;
  syncLastSeq = 0;

  transferMessage = '';
  transferError = '';

  private onlineSub?: Subscription;

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
    language: ['es' as 'es' | 'en', [Validators.required]],
    apiKey: [''],
    autoTagsEnabled: true,
    autoAliasEnabled: true
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly settingsService: SettingsService,
    private readonly syncService: SyncService,
    private readonly transferService: TransferService,
    private readonly warehouseService: WarehouseService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.syncOnline = this.syncService.isOnline();
    this.onlineSub = this.syncService.online$.subscribe((online) => {
      this.syncOnline = online;
    });
    this.loadSettings();
    this.refreshSyncStatus();
  }

  ngOnDestroy(): void {
    this.onlineSub?.unsubscribe();
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
        this.notificationService.success(res.message || 'Contraseña actualizada correctamente.');
        this.passwordForm.reset();
      },
      error: () => {
        this.passwordLoading = false;
        this.passwordError = 'No se pudo cambiar la contraseña.';
        this.notificationService.error(this.passwordError);
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
          this.notificationService.success(this.smtpMessage);
          this.smtpPasswordMasked = res.password_masked;
          this.smtpForm.patchValue({ password: '' });
        },
        error: () => {
          this.smtpLoading = false;
          this.smtpError = 'No se pudo guardar SMTP.';
          this.notificationService.error(this.smtpError);
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
        this.notificationService.success(res.message || 'Test SMTP completado.');
      },
      error: () => {
        this.smtpError = 'No se pudo ejecutar test SMTP.';
        this.notificationService.error(this.smtpError);
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
        language: raw.language,
        model_priority: [...this.llmModelPriority],
        api_key: raw.apiKey || null,
        auto_tags_enabled: raw.autoTagsEnabled,
        auto_alias_enabled: raw.autoAliasEnabled
      })
      .subscribe({
        next: (res) => {
          this.llmLoading = false;
          this.llmMessage = 'LLM guardado.';
          this.notificationService.success(this.llmMessage);
          this.llmForm.patchValue({ apiKey: res.api_key_value || '' });
          this.llmModelPriority = this.normalizeModelPriority(res.model_priority);
          this.llmApiKeyVisible = false;
        },
        error: () => {
          this.llmLoading = false;
          this.llmError = 'No se pudo guardar LLM.';
          this.notificationService.error(this.llmError);
        }
      });
  }

  getGeminiModelLabel(modelId: GeminiModelId): string {
    return this.geminiModelCatalog.find((entry) => entry.id === modelId)?.label || modelId;
  }

  moveModelPriority(index: number, offset: -1 | 1): void {
    const target = index + offset;
    if (target < 0 || target >= this.llmModelPriority.length) {
      return;
    }
    const next = [...this.llmModelPriority];
    const [selected] = next.splice(index, 1);
    next.splice(target, 0, selected);
    this.llmModelPriority = next;
  }

  resetModelPriority(): void {
    this.llmModelPriority = [...this.defaultLlmModelPriority];
  }

  toggleLlmApiKeyVisibility(): void {
    this.llmApiKeyVisible = !this.llmApiKeyVisible;
  }

  async refreshSyncStatus(): Promise<void> {
    if (!this.selectedWarehouseId) {
      return;
    }

    this.syncError = '';
    try {
      this.syncQueueCount = await this.syncService.getQueueCount(this.selectedWarehouseId);
      const pull = await this.syncService.pull(this.selectedWarehouseId);
      this.syncConflictsCount = pull.conflicts.length;
      this.syncLastSeq = pull.last_seq;
    } catch {
      this.syncError = 'No se pudo refrescar el estado de sync.';
    }
  }

  async forceSync(): Promise<void> {
    if (!this.selectedWarehouseId) {
      return;
    }

    this.syncLoading = true;
    this.syncError = '';
    this.syncMessage = '';
    try {
      const summary = await this.syncService.forceSync(this.selectedWarehouseId);
      this.syncQueueCount = summary.queueCountAfter;
      this.syncConflictsCount = summary.conflicts;
      this.syncLastSeq = summary.lastSeq;
      this.syncMessage = `Sync completado. Aplicados: ${summary.applied}, cola restante: ${summary.queueCountAfter}.`;
      this.notificationService.success(this.syncMessage);
    } catch {
      this.syncError = 'No se pudo ejecutar la sincronización.';
      this.notificationService.error(this.syncError);
    } finally {
      this.syncLoading = false;
    }
  }

  exportWarehouse(): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    this.transferError = '';
    this.transferMessage = '';
    this.transferService.exportWarehouse(this.selectedWarehouseId).subscribe({
      next: (snapshot) => {
        this.downloadSnapshot(snapshot);
        this.transferMessage = 'Export generado correctamente.';
        this.notificationService.success(this.transferMessage);
      },
      error: () => {
        this.transferError = 'No se pudo exportar el warehouse.';
        this.notificationService.error(this.transferError);
      }
    });
  }

  async importWarehouse(event: Event): Promise<void> {
    if (!this.selectedWarehouseId) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (!file) {
      return;
    }

    this.transferError = '';
    this.transferMessage = '';

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as WarehouseExportPayload;
      this.transferService.importWarehouse(this.selectedWarehouseId, parsed).subscribe({
        next: (res) => {
          this.transferMessage = `${res.message}. Boxes: ${res.boxes_upserted}, Items: ${res.items_upserted}, Movimientos: ${res.stock_movements_upserted}.`;
          this.notificationService.success('Importación completada correctamente.');
        },
        error: () => {
          this.transferError = 'No se pudo importar el JSON.';
          this.notificationService.error(this.transferError);
        }
      });
    } catch {
      this.transferError = 'Archivo JSON inválido.';
      this.notificationService.error(this.transferError);
    } finally {
      input.value = '';
    }
  }

  private downloadSnapshot(snapshot: WarehouseExportPayload): void {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `my-warehouse-export-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
          language: llm.language,
          apiKey: llm.api_key_value || '',
          autoTagsEnabled: llm.auto_tags_enabled,
          autoAliasEnabled: llm.auto_alias_enabled
        });
        this.llmModelPriority = this.normalizeModelPriority(llm.model_priority);
      }
    });
  }

  private normalizeModelPriority(input: GeminiModelId[] | null | undefined): GeminiModelId[] {
    if (!input || input.length !== this.defaultLlmModelPriority.length) {
      return [...this.defaultLlmModelPriority];
    }
    const unique = Array.from(new Set(input));
    if (unique.length !== this.defaultLlmModelPriority.length) {
      return [...this.defaultLlmModelPriority];
    }
    const allowed = new Set(this.defaultLlmModelPriority);
    if (unique.some((model) => !allowed.has(model))) {
      return [...this.defaultLlmModelPriority];
    }
    return [...input];
  }
}
