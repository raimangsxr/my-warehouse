import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';

import { generateUuid } from '../core/uuid';
import {
  IntakeBatch,
  IntakeDraft,
  IntakeService
} from '../services/intake.service';
import { NotificationService } from '../services/notification.service';
import { WarehouseService } from '../services/warehouse.service';

type IntakeUiStatus = 'new' | 'processed' | 'error' | 'saved';
type DraftEditorField = 'name' | 'description' | 'tagsText' | 'aliasesText';

interface DraftEditorState {
  name: string;
  description: string;
  tagsText: string;
  aliasesText: string;
  dirtyFields: Record<DraftEditorField, boolean>;
}

type CaptureUploadStatus = 'queued' | 'uploading' | 'error';

interface CaptureUploadEntry {
  id: string;
  file: File;
  label: string;
  status: CaptureUploadStatus;
  errorMessage: string;
}

const AUTO_REFRESH_INTERVAL_MS = 5000;

@Component({
  selector: 'app-item-intake-batch',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="app-page" *ngIf="batch">
      <header class="page-header intake-header">
        <div>
          <div class="batch-title-row">
            <h1 class="page-title">{{ batchTitle() }}</h1>
            <span class="batch-target-chip" *ngIf="batch.target_box_name" matTooltip="Caja destino del lote">
              <mat-icon>inventory_2</mat-icon>
              <span>{{ batch.target_box_name }}</span>
            </span>
          </div>
          <p class="page-subtitle">
            Creado hace {{ daysSinceCreated(batch.created_at) }} día(s) · {{ drafts.length }} artículo(s) en gestión temporal.
          </p>
        </div>
        <div class="batch-actions" role="group" aria-label="Acciones del lote">
          <button
            mat-icon-button
            type="button"
            matTooltip="Añadir artículo (foto)"
            aria-label="Añadir artículo"
            (click)="openCaptureEntry()"
            [disabled]="committing"
          >
            <mat-icon>add_a_photo</mat-icon>
          </button>
          <button
            mat-icon-button
            type="button"
            matTooltip="Guardar procesados"
            aria-label="Guardar procesados"
            (click)="commitProcessed()"
            [disabled]="isProcessing || processedCount === 0 || committing"
          >
            <mat-icon>save</mat-icon>
          </button>
          <button
            mat-icon-button
            type="button"
            matTooltip="Reprocesar errores"
            aria-label="Reprocesar errores"
            (click)="reprocessErrorsSequentially()"
            [disabled]="isProcessing || errorCount === 0"
          >
            <mat-icon>auto_awesome</mat-icon>
          </button>
          <button
            mat-icon-button
            color="warn"
            type="button"
            matTooltip="Eliminar lote"
            aria-label="Eliminar lote"
            (click)="deleteBatch()"
            [disabled]="isProcessing || committing"
          >
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </header>

      <mat-card class="surface-card" *ngIf="isProcessing || hasUploadingQueue">
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      </mat-card>

      <mat-card class="surface-card compact-card" *ngIf="captureQueue.length > 0">
        <mat-card-content>
          <div class="capture-queue-header">
            <div>
              <p class="editor-title">Cola local de capturas</p>
              <p class="status-line">
                En cola {{ queuedUploadCount }} · Subiendo {{ uploadingQueueCount }} · Error {{ failedUploadCount }}
              </p>
            </div>
            <div class="inline-actions">
              <button
                mat-stroked-button
                type="button"
                (click)="retryFailedUploads()"
                [disabled]="failedUploadCount === 0 || !batch"
              >
                Reintentar fallos
              </button>
            </div>
          </div>
          <div class="capture-queue-list">
            <article class="capture-queue-item" *ngFor="let entry of captureQueue; trackBy: trackByCaptureUploadId">
              <div>
                <p class="capture-queue-title">{{ entry.label }}</p>
                <p class="capture-queue-meta">{{ captureUploadStatusLabel(entry.status) }}</p>
                <p class="error" *ngIf="entry.errorMessage">{{ entry.errorMessage }}</p>
              </div>
              <button
                mat-icon-button
                type="button"
                matTooltip="Eliminar de la cola"
                aria-label="Eliminar de la cola"
                (click)="removeCaptureUpload(entry.id)"
                [disabled]="entry.status === 'uploading'"
              >
                <mat-icon>close</mat-icon>
              </button>
            </article>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card compact-card">
        <mat-card-content>
          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
          <div class="status-board" *ngIf="drafts.length > 0; else emptyBatch">
            <section class="status-column">
              <header class="status-column-head">
                <h2>Nuevo</h2>
                <span class="inline-chip">{{ newCount }}</span>
              </header>
              <div class="status-items">
                <article
                  class="status-item"
                  *ngFor="let draft of draftsByUiStatus('new'); trackBy: trackByDraftId"
                  [class.status-item-active]="draft.id === selectedDraftId"
                  (click)="selectDraft(draft.id)"
                  (keydown.enter)="selectDraftFromKeyboard($event, draft.id)"
                  (keydown.space)="selectDraftFromKeyboard($event, draft.id)"
                  tabindex="0"
                  role="button"
                >
                  <img [src]="draft.photo_url" [alt]="draftTitle(draft)" />
                  <div class="status-item-copy">
                    <span class="status-item-title">{{ draftTitle(draft) }}</span>
                    <span class="status-item-meta">{{ draft.description || 'Pendiente de análisis' }}</span>
                  </div>
                </article>
                <p class="status-empty" *ngIf="draftsByUiStatus('new').length === 0">Sin artículos</p>
              </div>
            </section>

            <section class="status-column">
              <header class="status-column-head">
                <h2>Procesado</h2>
                <span class="inline-chip">{{ processedCount }}</span>
              </header>
              <div class="status-items">
                <article
                  class="status-item status-item-stocked"
                  *ngFor="let draft of draftsByUiStatus('processed'); trackBy: trackByDraftId"
                  [class.status-item-active]="draft.id === selectedDraftId"
                  (click)="selectDraft(draft.id)"
                  (keydown.enter)="selectDraftFromKeyboard($event, draft.id)"
                  (keydown.space)="selectDraftFromKeyboard($event, draft.id)"
                  tabindex="0"
                  role="button"
                >
                  <img [src]="draft.photo_url" [alt]="draftTitle(draft)" />
                  <div class="status-item-copy">
                    <span class="status-item-title">{{ draftTitle(draft) }}</span>
                    <span class="status-item-meta">{{ draft.description || 'Listo para guardar' }}</span>
                  </div>
                  <div class="product-stock-inline status-stock-inline" (click)="$event.stopPropagation()">
                    <button
                      mat-icon-button
                      type="button"
                      class="stock-step-btn stock-step-dec"
                      (click)="adjustDraftQuantity(draft, -1)"
                      [disabled]="!canDecreaseDraftQuantity(draft)"
                      [attr.aria-label]="'Reducir cantidad de ' + draftTitle(draft)"
                      matTooltip="Reducir cantidad"
                    >
                      <mat-icon>remove</mat-icon>
                    </button>
                    <span class="stock-display" matTooltip="Cantidad a guardar">
                      <mat-icon>inventory_2</mat-icon>
                      <span>{{ draft.quantity }}</span>
                    </span>
                    <button
                      mat-icon-button
                      color="primary"
                      type="button"
                      class="stock-step-btn stock-step-inc"
                      (click)="adjustDraftQuantity(draft, 1)"
                      [disabled]="!canIncreaseDraftQuantity(draft)"
                      [attr.aria-label]="'Incrementar cantidad de ' + draftTitle(draft)"
                      matTooltip="Incrementar cantidad"
                    >
                      <mat-icon>add</mat-icon>
                    </button>
                  </div>
                </article>
                <p class="status-empty" *ngIf="draftsByUiStatus('processed').length === 0">Sin artículos</p>
              </div>
            </section>

            <section class="status-column">
              <header class="status-column-head">
                <h2>Error</h2>
                <span class="inline-chip">{{ errorCount }}</span>
              </header>
              <div class="status-items">
                <article
                  class="status-item"
                  *ngFor="let draft of draftsByUiStatus('error'); trackBy: trackByDraftId"
                  [class.status-item-active]="draft.id === selectedDraftId"
                  (click)="selectDraft(draft.id)"
                  (keydown.enter)="selectDraftFromKeyboard($event, draft.id)"
                  (keydown.space)="selectDraftFromKeyboard($event, draft.id)"
                  tabindex="0"
                  role="button"
                >
                  <img [src]="draft.photo_url" [alt]="draftTitle(draft)" />
                  <div class="status-item-copy">
                    <span class="status-item-title">{{ draftTitle(draft) }}</span>
                    <span class="status-item-meta">{{ draft.error_message || 'Revisión requerida' }}</span>
                  </div>
                </article>
                <p class="status-empty" *ngIf="draftsByUiStatus('error').length === 0">Sin artículos</p>
              </div>
            </section>

            <section class="status-column">
              <header class="status-column-head">
                <h2>Guardado</h2>
                <span class="inline-chip">{{ savedCount }}</span>
              </header>
              <div class="status-items">
                <article
                  class="status-item status-item-stocked"
                  *ngFor="let draft of draftsByUiStatus('saved'); trackBy: trackByDraftId"
                  [class.status-item-active]="draft.id === selectedDraftId"
                  (click)="selectDraft(draft.id)"
                  (keydown.enter)="selectDraftFromKeyboard($event, draft.id)"
                  (keydown.space)="selectDraftFromKeyboard($event, draft.id)"
                  tabindex="0"
                  role="button"
                >
                  <img [src]="draft.photo_url" [alt]="draftTitle(draft)" />
                  <div class="status-item-copy">
                    <span class="status-item-title">{{ draftTitle(draft) }}</span>
                    <span class="status-item-meta">{{ draft.description || 'Artículo guardado en inventario' }}</span>
                  </div>
                  <div class="product-stock-inline status-stock-inline" (click)="$event.stopPropagation()">
                    <button
                      mat-icon-button
                      type="button"
                      class="stock-step-btn stock-step-dec"
                      (click)="adjustDraftQuantity(draft, -1)"
                      [disabled]="!canDecreaseDraftQuantity(draft)"
                      [attr.aria-label]="'Reducir stock de ' + draftTitle(draft)"
                      matTooltip="Reducir stock"
                    >
                      <mat-icon>remove</mat-icon>
                    </button>
                    <span class="stock-display" matTooltip="Stock actual desde el lote">
                      <mat-icon>inventory_2</mat-icon>
                      <span>{{ draft.quantity }}</span>
                    </span>
                    <button
                      mat-icon-button
                      color="primary"
                      type="button"
                      class="stock-step-btn stock-step-inc"
                      (click)="adjustDraftQuantity(draft, 1)"
                      [disabled]="!canIncreaseDraftQuantity(draft)"
                      [attr.aria-label]="'Incrementar stock de ' + draftTitle(draft)"
                      matTooltip="Incrementar stock"
                    >
                      <mat-icon>add</mat-icon>
                    </button>
                  </div>
                </article>
                <p class="status-empty" *ngIf="draftsByUiStatus('saved').length === 0">Sin artículos</p>
              </div>
            </section>
          </div>

          <ng-template #emptyBatch>
            <div class="empty-state">Todavía no hay artículos en este lote.</div>
          </ng-template>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card" *ngIf="selectedDraft as draft">
        <mat-card-content>
          <div class="editor-header">
            <p class="editor-title">Detalle de artículo</p>
            <button
              mat-icon-button
              type="button"
              matTooltip="Cerrar detalle"
              aria-label="Cerrar detalle"
              (click)="closeSelectedDraft()"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="editor-grid">
            <img [src]="draft.photo_url" [alt]="draftTitle(draft)" class="editor-photo" />

            <div>
              <div class="inline-actions chips-row">
                <span class="inline-chip">Estado: {{ uiStatusLabel(uiStatusOf(draft)) }}</span>
                <span class="inline-chip" *ngIf="draft.confidence > 0">Confianza: {{ confidencePercent(draft.confidence) }}%</span>
              </div>

              <div class="editor-stock-row">
                <div class="product-stock-inline editor-stock-inline">
                  <button
                    mat-icon-button
                    type="button"
                    class="stock-step-btn stock-step-dec"
                    (click)="adjustDraftQuantity(draft, -1)"
                    [disabled]="!canDecreaseDraftQuantity(draft)"
                    [attr.aria-label]="'Reducir cantidad de ' + draftTitle(draft)"
                    matTooltip="Reducir cantidad"
                  >
                    <mat-icon>remove</mat-icon>
                  </button>
                  <span class="stock-display" [matTooltip]="draft.status === 'committed' ? 'Stock actual desde el lote' : 'Cantidad a guardar'">
                    <mat-icon>inventory_2</mat-icon>
                    <span>{{ draft.quantity }}</span>
                  </span>
                  <button
                    mat-icon-button
                    color="primary"
                    type="button"
                    class="stock-step-btn stock-step-inc"
                    (click)="adjustDraftQuantity(draft, 1)"
                    [disabled]="!canIncreaseDraftQuantity(draft)"
                    [attr.aria-label]="'Incrementar cantidad de ' + draftTitle(draft)"
                    matTooltip="Incrementar cantidad"
                  >
                    <mat-icon>add</mat-icon>
                  </button>
                </div>
                <p class="status-line">
                  {{ draft.status === 'committed' ? 'Stock editable desde el propio lote.' : 'Cantidad objetivo antes de guardar.' }}
                </p>
              </div>

              <mat-form-field class="full-width compact-field">
                <mat-label>Nombre</mat-label>
                <input
                  matInput
                  [ngModel]="editorFor(draft).name"
                  (ngModelChange)="updateEditorField(draft.id, 'name', $event)"
                  [disabled]="isDraftReadOnly(draft)"
                  maxlength="160"
                />
              </mat-form-field>

              <mat-form-field class="full-width compact-field">
                <mat-label>Descripción</mat-label>
                <textarea
                  matInput
                  rows="3"
                  [ngModel]="editorFor(draft).description"
                  (ngModelChange)="updateEditorField(draft.id, 'description', $event)"
                  [disabled]="isDraftReadOnly(draft)"
                  maxlength="1000"
                ></textarea>
              </mat-form-field>

              <div class="form-row compact-row">
                <mat-form-field class="compact-field">
                  <mat-label>Tags</mat-label>
                  <input
                    matInput
                    [ngModel]="editorFor(draft).tagsText"
                    (ngModelChange)="updateEditorField(draft.id, 'tagsText', $event)"
                    [disabled]="isDraftReadOnly(draft)"
                  />
                </mat-form-field>

                <mat-form-field class="compact-field">
                  <mat-label>Aliases</mat-label>
                  <input
                    matInput
                    [ngModel]="editorFor(draft).aliasesText"
                    (ngModelChange)="updateEditorField(draft.id, 'aliasesText', $event)"
                    [disabled]="isDraftReadOnly(draft)"
                  />
                </mat-form-field>
              </div>

              <p class="status-line" *ngIf="draft.warnings.length > 0">{{ draft.warnings.join(' · ') }}</p>
              <p class="error" *ngIf="draft.error_message">{{ draft.error_message }}</p>

              <div class="inline-actions editor-actions">
                <button
                  mat-icon-button
                  type="button"
                  matTooltip="Guardar cambios"
                  aria-label="Guardar cambios"
                  (click)="saveDraft(draft)"
                  [disabled]="isDraftReadOnly(draft)"
                >
                  <mat-icon>save</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  matTooltip="Re-procesar con IA (foto)"
                  aria-label="Re-procesar con IA por foto"
                  (click)="reprocessDraftByPhoto(draft)"
                  [disabled]="isDraftReadOnly(draft)"
                >
                  <mat-icon>photo_camera</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  matTooltip="Re-procesar con IA (título)"
                  aria-label="Re-procesar con IA por título"
                  (click)="reprocessDraftByName(draft)"
                  [disabled]="isDraftReadOnly(draft)"
                >
                  <mat-icon>title</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="primary"
                  type="button"
                  matTooltip="Marcar como procesado"
                  aria-label="Marcar como procesado"
                  *ngIf="uiStatusOf(draft) === 'error'"
                  (click)="markErrorAsProcessed(draft)"
                  [disabled]="isDraftReadOnly(draft)"
                >
                  <mat-icon>check_circle</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                  type="button"
                  matTooltip="Eliminar artículo"
                  aria-label="Eliminar artículo"
                  (click)="deleteDraft(draft)"
                  [disabled]="isDraftReadOnly(draft)"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <input
        #photoInput
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.heic,.heif"
        capture="environment"
        multiple
        (change)="onFilesSelected($event)"
        class="sr-only-input"
      />

      <div class="capture-overlay" *ngIf="cameraOverlayOpen">
        <div class="capture-backdrop" (click)="closeCameraOverlay()"></div>
        <div class="capture-panel" role="dialog" aria-modal="true" aria-label="Captura continua de artículos">
          <div class="capture-panel-header">
            <div>
              <p class="editor-title">Captura continua</p>
              <p class="status-line">Acepta una foto y la cámara queda lista para la siguiente.</p>
            </div>
            <button mat-icon-button type="button" aria-label="Cerrar cámara" (click)="closeCameraOverlay()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="capture-stage">
            <div class="capture-media-frame">
              <video #cameraVideo autoplay playsinline muted class="camera-video"></video>
              <img
                *ngIf="capturedPreviewUrl"
                [src]="capturedPreviewUrl"
                alt="Previsualización de captura"
                class="camera-preview camera-preview-overlay"
              />
            </div>
            <div class="status-line" *ngIf="cameraLoading && !capturedPreviewUrl">Abriendo cámara...</div>
            <div class="error" *ngIf="cameraErrorMessage && !capturedPreviewUrl">{{ cameraErrorMessage }}</div>
          </div>

          <div class="capture-panel-actions" *ngIf="!capturedPreviewUrl">
            <button mat-stroked-button type="button" (click)="openPicker()">Subir desde galería</button>
            <button mat-flat-button color="primary" type="button" (click)="capturePhoto()" [disabled]="cameraLoading || !cameraStreamActive">
              Capturar
            </button>
          </div>

          <div class="capture-panel-actions" *ngIf="capturedPreviewUrl">
            <button mat-stroked-button type="button" (click)="discardCapturedPreview()">Repetir</button>
            <button mat-flat-button color="primary" type="button" (click)="acceptCapturedPhoto()">Aceptar y siguiente</button>
          </div>

          <canvas #cameraCanvas class="camera-canvas"></canvas>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .sr-only-input {
        display: none;
      }

      .intake-header {
        align-items: flex-start;
      }

      .batch-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .batch-target-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(191, 216, 255, 0.8);
        background: #edf4ff;
        color: #234e9c;
        font-size: 0.8rem;
        font-weight: 600;
        line-height: 1;
      }

      .batch-target-chip .mat-icon {
        width: 15px;
        height: 15px;
        font-size: 15px;
      }

      .batch-actions {
        display: inline-flex;
        gap: 2px;
        border: 1px solid var(--border-soft);
        border-radius: 999px;
        background: linear-gradient(180deg, #ffffff 0%, #f7f9fd 100%);
        padding: 2px;
      }

      .status-board {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .status-column {
        border: 1px solid var(--border-soft);
        border-radius: 12px;
        background: #ffffff;
        padding: 8px;
        min-width: 0;
      }

      .status-column-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }

      .status-column-head h2 {
        margin: 0;
        font-size: 0.92rem;
      }

      .status-items {
        display: grid;
        gap: 6px;
      }

      .status-item {
        border: 1px solid var(--border-soft);
        border-radius: 10px;
        background: #f8fbff;
        padding: 6px;
        cursor: pointer;
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr);
        gap: 6px;
        align-items: center;
      }

      .status-item-stocked {
        grid-template-columns: 44px minmax(0, 1fr);
        gap: 8px;
      }

      .status-item img {
        width: 44px;
        height: 44px;
        border-radius: 8px;
        border: 1px solid var(--border-soft);
        object-fit: cover;
        background: #eef3fb;
      }

      .status-item-copy {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .status-item-title,
      .status-item-meta {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .status-item-title {
        white-space: nowrap;
        font-size: 0.8rem;
        color: var(--text-1);
        font-weight: 600;
      }

      .status-item-meta {
        font-size: 0.73rem;
        color: var(--text-2);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .status-item-active {
        border-color: rgba(57, 73, 171, 0.45);
        background: rgba(57, 73, 171, 0.08);
      }

      .status-empty {
        margin: 0;
        font-size: 0.78rem;
        color: var(--text-3);
      }

      .product-stock-inline {
        display: grid;
        grid-template-columns: 32px minmax(0, 1fr) 32px;
        align-items: center;
        gap: 3px;
        width: 100%;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid rgba(191, 216, 255, 0.8);
        background: #edf4ff;
        color: #234e9c;
        min-height: 38px;
      }

      .status-stock-inline {
        grid-column: 1 / -1;
      }

      .stock-display {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 0.82rem;
        font-weight: 600;
        min-width: 0;
        line-height: 1;
      }

      .stock-display .mat-icon {
        width: 16px;
        height: 16px;
        font-size: 16px;
      }

      .stock-step-btn {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        width: 30px !important;
        min-width: 30px !important;
        height: 30px !important;
        padding: 0 !important;
        line-height: 1 !important;
        color: inherit;
      }

      .stock-step-btn .mat-icon {
        display: block;
        width: 18px;
        height: 18px;
        font-size: 18px;
        line-height: 18px;
        margin: 0;
        vertical-align: middle;
      }

      .editor-stock-row {
        display: grid;
        gap: 6px;
        margin-bottom: 8px;
      }

      .editor-stock-inline {
        max-width: 220px;
      }

      .editor-grid {
        display: grid;
        grid-template-columns: 220px minmax(0, 1fr);
        gap: 12px;
      }

      .editor-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .editor-title {
        margin: 0;
        font-weight: 600;
        color: var(--text-1);
      }

      .editor-photo {
        width: 100%;
        height: 220px;
        border-radius: 12px;
        border: 1px solid var(--border-soft);
        object-fit: cover;
        background: #eef3fb;
      }

      .compact-field {
        margin-bottom: -1.05em;
      }

      .compact-row {
        gap: 8px;
      }

      .chips-row {
        margin-bottom: 8px;
        flex-wrap: wrap;
      }

      .editor-actions {
        margin-top: 8px;
        gap: 4px;
      }

      .capture-queue-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .capture-queue-list {
        display: grid;
        gap: 8px;
        margin-top: 10px;
      }

      .capture-queue-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        padding: 8px 10px;
        border: 1px solid var(--border-soft);
        border-radius: 12px;
        background: #f8fbff;
      }

      .capture-queue-title {
        margin: 0;
        font-size: 0.84rem;
        font-weight: 600;
        color: var(--text-1);
      }

      .capture-queue-meta {
        margin: 2px 0 0;
        font-size: 0.76rem;
        color: var(--text-2);
      }

      .capture-overlay {
        position: fixed;
        inset: 0;
        z-index: 1100;
        display: grid;
        place-items: center;
        padding: 16px;
      }

      .capture-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.56);
      }

      .capture-panel {
        position: relative;
        width: min(100%, 720px);
        display: grid;
        gap: 12px;
        padding: 14px;
        border-radius: 18px;
        background: #ffffff;
        border: 1px solid rgba(203, 213, 225, 0.9);
        box-shadow: 0 24px 64px rgba(15, 23, 42, 0.24);
      }

      .capture-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .capture-stage {
        display: grid;
        gap: 8px;
      }

      .capture-media-frame {
        position: relative;
      }

      .camera-video,
      .camera-preview {
        display: block;
        width: 100%;
        max-height: 62vh;
        border-radius: 16px;
        border: 1px solid var(--border-soft);
        background: #0f172a;
        object-fit: cover;
      }

      .camera-preview-overlay {
        position: absolute;
        inset: 0;
        height: 100%;
      }

      .camera-canvas {
        display: none;
      }

      .capture-panel-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
      }

      @media (max-width: 1200px) {
        .status-board {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 760px) {
        .status-board {
          grid-template-columns: 1fr;
        }

        .capture-queue-header {
          flex-direction: column;
        }

        .capture-panel {
          width: 100%;
          padding: 12px;
        }

        .capture-panel-actions {
          justify-content: stretch;
        }

        .capture-panel-actions button {
          flex: 1 1 180px;
        }

        .editor-grid {
          grid-template-columns: 1fr;
        }

        .editor-photo {
          height: 220px;
        }
      }
    `
  ]
})
export class ItemIntakeBatchComponent implements OnInit, OnDestroy {
  @ViewChild('photoInput') photoInput?: ElementRef<HTMLInputElement>;
  @ViewChild('cameraVideo') cameraVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraCanvas') cameraCanvas?: ElementRef<HTMLCanvasElement>;

  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();

  batch: IntakeBatch | null = null;
  drafts: IntakeDraft[] = [];
  selectedDraftId: string | null = null;

  committing = false;
  errorMessage = '';
  captureQueue: CaptureUploadEntry[] = [];
  cameraOverlayOpen = false;
  cameraLoading = false;
  cameraErrorMessage = '';
  capturedPreviewUrl: string | null = null;
  cameraStreamActive = false;

  private readonly draftEditors = new Map<string, DraftEditorState>();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private routeParamSub?: Subscription;
  private detailPanelClosedManually = false;
  private activeLoadSub?: Subscription;
  private batchLoadInFlight = false;
  private pendingLoad: { batchId: string; silent: boolean } | null = null;
  private autoRefreshBatchId: string | null = null;
  private pendingCapturedFile: File | null = null;
  private cameraStream: MediaStream | null = null;
  private uploadQueueBusy = false;

  constructor(
    private readonly warehouseService: WarehouseService,
    private readonly intakeService: IntakeService,
    private readonly notificationService: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (!this.selectedWarehouseId) {
      this.router.navigateByUrl('/warehouses');
      return;
    }

    this.routeParamSub = this.route.paramMap.subscribe((params) => {
      const batchId = params.get('batchId');
      if (!batchId) {
        this.stopAutoRefresh();
        this.cancelActiveLoad();
        this.router.navigate(['/app/batches']).catch(() => {});
        return;
      }
      if (this.batch?.id !== batchId) {
        this.stopAutoRefresh();
        this.cancelActiveLoad();
        this.detailPanelClosedManually = false;
        this.selectedDraftId = null;
        this.batch = null;
        this.drafts = [];
        this.captureQueue = [];
        this.closeCameraOverlay().catch(() => {});
        this.loadBatch(batchId);
      }
      this.startAutoRefresh(batchId);
    });
  }

  ngOnDestroy(): void {
    this.routeParamSub?.unsubscribe();
    this.stopAutoRefresh();
    this.cancelActiveLoad();
    this.stopCameraStream();
    this.clearCapturedPreview();
  }

  get selectedDraft(): IntakeDraft | null {
    if (!this.selectedDraftId) {
      return null;
    }
    return this.drafts.find((draft) => draft.id === this.selectedDraftId) || null;
  }

  get newCount(): number {
    return this.draftsByUiStatus('new').length;
  }

  get processedCount(): number {
    return this.draftsByUiStatus('processed').length;
  }

  get errorCount(): number {
    return this.draftsByUiStatus('error').length;
  }

  get savedCount(): number {
    return this.draftsByUiStatus('saved').length;
  }

  get isProcessing(): boolean {
    return this.batch?.status === 'processing' || this.drafts.some((draft) => draft.status === 'processing');
  }

  get hasUploadingQueue(): boolean {
    return this.captureQueue.some((entry) => entry.status === 'queued' || entry.status === 'uploading');
  }

  get queuedUploadCount(): number {
    return this.captureQueue.filter((entry) => entry.status === 'queued').length;
  }

  get uploadingQueueCount(): number {
    return this.captureQueue.filter((entry) => entry.status === 'uploading').length;
  }

  get failedUploadCount(): number {
    return this.captureQueue.filter((entry) => entry.status === 'error').length;
  }

  trackByDraftId(_index: number, draft: IntakeDraft): string {
    return draft.id;
  }

  trackByCaptureUploadId(_index: number, entry: CaptureUploadEntry): string {
    return entry.id;
  }

  batchTitle(): string {
    if (!this.batch) {
      return 'Lote';
    }
    return this.batch.name || `Lote ${this.batch.id.slice(0, 8)}`;
  }

  daysSinceCreated(createdAt: string): number {
    const createdMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdMs)) {
      return 0;
    }
    const elapsed = Date.now() - createdMs;
    return Math.max(0, Math.floor(elapsed / 86_400_000));
  }

  uiStatusOf(draft: IntakeDraft): IntakeUiStatus {
    if (draft.status === 'uploaded' || draft.status === 'processing') {
      return 'new';
    }
    if (draft.status === 'ready' || draft.status === 'review') {
      return 'processed';
    }
    if (draft.status === 'committed') {
      return 'saved';
    }
    return 'error';
  }

  uiStatusLabel(status: IntakeUiStatus): string {
    const labels: Record<IntakeUiStatus, string> = {
      new: 'Nuevo',
      processed: 'Procesado',
      error: 'Error',
      saved: 'Guardado'
    };
    return labels[status];
  }

  draftsByUiStatus(status: IntakeUiStatus): IntakeDraft[] {
    return this.drafts.filter((draft) => this.uiStatusOf(draft) === status);
  }

  captureUploadStatusLabel(status: CaptureUploadStatus): string {
    const labels: Record<CaptureUploadStatus, string> = {
      queued: 'Pendiente de subida',
      uploading: 'Subiendo al backend',
      error: 'Error de subida'
    };
    return labels[status];
  }

  selectDraft(draftId: string): void {
    this.detailPanelClosedManually = false;
    this.selectedDraftId = draftId;
  }

  selectDraftFromKeyboard(event: KeyboardEvent, draftId: string): void {
    event.preventDefault();
    this.selectDraft(draftId);
  }

  closeSelectedDraft(): void {
    this.selectedDraftId = null;
    this.detailPanelClosedManually = true;
  }

  draftTitle(draft: IntakeDraft): string {
    const name = (draft.name || '').trim();
    if (name) {
      return name;
    }
    const fallbackByStatus: Record<IntakeUiStatus, string> = {
      new: 'Artículo nuevo',
      processed: 'Artículo procesado',
      error: 'Artículo con error',
      saved: 'Artículo guardado'
    };
    return fallbackByStatus[this.uiStatusOf(draft)];
  }

  confidencePercent(value: number): number {
    return Math.round(value * 100);
  }

  canAdjustDraftQuantity(draft: IntakeDraft): boolean {
    const status = this.uiStatusOf(draft);
    return !this.committing && (status === 'processed' || status === 'saved');
  }

  canDecreaseDraftQuantity(draft: IntakeDraft): boolean {
    return this.canAdjustDraftQuantity(draft) && draft.quantity > 1;
  }

  canIncreaseDraftQuantity(draft: IntakeDraft): boolean {
    return this.canAdjustDraftQuantity(draft) && draft.quantity < 9999;
  }

  editorFor(draft: IntakeDraft): DraftEditorState {
    const existing = this.draftEditors.get(draft.id);
    if (existing) {
      return existing;
    }

    const nextState = this.createEditorState(draft);
    this.draftEditors.set(draft.id, nextState);
    return nextState;
  }

  updateEditorField(draftId: string, field: DraftEditorField, value: string): void {
    const draft = this.drafts.find((candidate) => candidate.id === draftId);
    if (!draft) {
      return;
    }

    const editor = this.editorFor(draft);
    editor[field] = value;
    editor.dirtyFields[field] = value !== this.serverValueForField(draft, field);
  }

  isDraftReadOnly(draft: IntakeDraft): boolean {
    return this.committing || draft.status === 'processing' || draft.status === 'committed';
  }

  openCaptureEntry(): void {
    if (!this.batch || this.committing) {
      return;
    }
    if (!this.isCameraSupported()) {
      this.openPicker();
      return;
    }
    this.openCameraOverlay();
  }

  openPicker(): void {
    if (!this.batch || this.committing) {
      return;
    }
    const input = this.photoInput?.nativeElement;
    if (!input) {
      return;
    }
    input.value = '';
    input.click();
  }

  onFilesSelected(event: Event): void {
    if (!this.selectedWarehouseId || !this.batch) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) {
      return;
    }

    this.errorMessage = '';
    this.enqueueFiles(files);
    input.value = '';
  }

  adjustDraftQuantity(draft: IntakeDraft, delta: 1 | -1): void {
    if (!this.selectedWarehouseId) {
      return;
    }
    const nextQuantity = draft.quantity + delta;
    if (nextQuantity < 1 || nextQuantity > 9999 || !this.canAdjustDraftQuantity(draft)) {
      return;
    }

    this.intakeService
      .updateDraft(this.selectedWarehouseId, draft.id, { quantity: nextQuantity })
      .subscribe({
        next: (updated) => {
          this.replaceDraft(updated);
        },
        error: () => {
          const label = this.uiStatusOf(draft) === 'saved' ? 'stock' : 'cantidad';
          this.setActionError(`No se pudo actualizar el ${label} del artículo.`);
        }
      });
  }

  retryFailedUploads(): void {
    const hasChanges = this.captureQueue.some((entry) => entry.status === 'error');
    if (!hasChanges) {
      return;
    }
    this.captureQueue = this.captureQueue.map((entry) =>
      entry.status === 'error' ? { ...entry, status: 'queued', errorMessage: '' } : entry
    );
    this.flushCaptureQueue();
  }

  removeCaptureUpload(entryId: string): void {
    this.captureQueue = this.captureQueue.filter((entry) => entry.id !== entryId);
  }

  async capturePhoto(): Promise<void> {
    const video = this.cameraVideo?.nativeElement;
    const canvas = this.cameraCanvas?.nativeElement;
    if (!video || !canvas || !this.cameraStreamActive) {
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      this.setActionError('No se pudo preparar la captura de la cámara.');
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) {
      this.setActionError('No se pudo generar la foto capturada.');
      return;
    }

    const file = new File([blob], `captura-${Date.now()}.jpg`, {
      type: blob.type || 'image/jpeg',
      lastModified: Date.now()
    });
    this.pendingCapturedFile = file;
    this.clearCapturedPreview();
    this.capturedPreviewUrl = URL.createObjectURL(blob);
  }

  acceptCapturedPhoto(): void {
    if (!this.pendingCapturedFile) {
      return;
    }
    this.enqueueFiles([this.pendingCapturedFile]);
    this.pendingCapturedFile = null;
    this.clearCapturedPreview();
  }

  discardCapturedPreview(): void {
    this.pendingCapturedFile = null;
    this.clearCapturedPreview();
  }

  async closeCameraOverlay(): Promise<void> {
    this.cameraOverlayOpen = false;
    this.cameraLoading = false;
    this.pendingCapturedFile = null;
    this.clearCapturedPreview();
    this.stopCameraStream();
  }

  saveDraft(draft: IntakeDraft): void {
    if (!this.selectedWarehouseId || this.isDraftReadOnly(draft)) {
      return;
    }

    const editor = this.editorFor(draft);
    this.intakeService
      .updateDraft(this.selectedWarehouseId, draft.id, {
        name: editor.name.trim() || null,
        description: editor.description.trim() || null,
        tags: splitCsv(editor.tagsText),
        aliases: splitCsv(editor.aliasesText)
      })
      .subscribe({
        next: (updated) => {
          this.replaceDraft(updated);
          this.notificationService.success('Artículo actualizado.');
        },
        error: () => {
          this.setActionError('No se pudieron guardar los cambios del artículo.');
        }
      });
  }

  markErrorAsProcessed(draft: IntakeDraft): void {
    if (!this.selectedWarehouseId || this.isDraftReadOnly(draft) || this.uiStatusOf(draft) !== 'error') {
      return;
    }

    const editor = this.editorFor(draft);
    const normalizedName = editor.name.trim();
    if (!normalizedName) {
      this.setActionError('El nombre es obligatorio para marcar el artículo como procesado.');
      return;
    }

    this.intakeService
      .updateDraft(this.selectedWarehouseId, draft.id, {
        name: normalizedName,
        description: editor.description.trim() || null,
        tags: splitCsv(editor.tagsText),
        aliases: splitCsv(editor.aliasesText),
        status: 'ready'
      })
      .subscribe({
        next: (updated) => {
          this.replaceDraft(updated);
          this.notificationService.success('Artículo marcado como procesado.');
        },
        error: () => {
          this.setActionError('No se pudo marcar el artículo como procesado.');
        }
      });
  }

  reprocessDraftByPhoto(draft: IntakeDraft): void {
    this.reprocessDraft(draft, 'photo');
  }

  reprocessDraftByName(draft: IntakeDraft): void {
    this.reprocessDraft(draft, 'name');
  }

  deleteDraft(draft: IntakeDraft): void {
    const warehouseId = this.selectedWarehouseId;
    if (!warehouseId || this.isDraftReadOnly(draft)) {
      return;
    }

    const label = this.draftTitle(draft);
    const confirmed = window.confirm(`¿Eliminar el artículo "${label}" del lote?`);
    if (!confirmed) {
      return;
    }

    this.intakeService.deleteDraft(warehouseId, draft.id).subscribe({
      next: () => {
        this.notificationService.success('Artículo eliminado del lote.');
        if (this.batch) {
          this.loadBatch(this.batch.id, true);
        }
      },
      error: () => {
        this.setActionError('No se pudo eliminar el artículo del lote.');
      }
    });
  }

  commitProcessed(): void {
    if (!this.selectedWarehouseId || !this.batch || this.processedCount === 0 || this.committing) {
      return;
    }

    this.committing = true;
    this.intakeService
      .commitBatch(this.selectedWarehouseId, this.batch.id)
      .pipe(finalize(() => (this.committing = false)))
      .subscribe({
        next: (response) => {
          this.batch = response.batch;
          this.loadBatch(response.batch.id, true);
          this.notificationService.success(`Se guardaron ${response.created} artículo(s) procesados.`);
        },
        error: () => {
          this.setActionError('No se pudieron guardar los artículos procesados.');
        }
      });
  }

  reprocessErrorsSequentially(): void {
    this.startProcessing(true);
  }

  deleteBatch(): void {
    if (!this.selectedWarehouseId || !this.batch || this.isProcessing) {
      return;
    }

    const label = this.batchTitle();
    const confirmed = window.confirm(`¿Eliminar el lote "${label}"? Esta acción no se puede deshacer.`);
    if (!confirmed) {
      return;
    }

    this.intakeService.deleteBatch(this.selectedWarehouseId, this.batch.id).subscribe({
      next: () => {
        this.notificationService.success('Lote eliminado.');
        this.stopAutoRefresh();
        this.router.navigate(['/app/batches']).catch(() => {});
      },
      error: () => {
        this.setActionError('No se pudo eliminar el lote.');
      }
    });
  }

  private startProcessing(retryErrors: boolean): void {
    if (!this.selectedWarehouseId || !this.batch || this.isProcessing) {
      return;
    }

    this.intakeService.startBatch(this.selectedWarehouseId, this.batch.id, retryErrors).subscribe({
      next: (response) => {
        this.batch = response.batch;
        this.notificationService.info(response.message);
        this.startAutoRefresh(response.batch.id);
      },
      error: () => {
        this.setActionError('No se pudo iniciar el procesamiento del lote.');
      }
    });
  }

  private loadBatch(batchId: string, silent = false): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    if (this.batchLoadInFlight) {
      this.pendingLoad = {
        batchId,
        silent: this.pendingLoad ? this.pendingLoad.silent && silent : silent
      };
      return;
    }

    this.batchLoadInFlight = true;
    this.activeLoadSub = this.intakeService
      .getBatch(this.selectedWarehouseId, batchId)
      .pipe(finalize(() => this.finishBatchLoad()))
      .subscribe({
        next: (response) => {
          this.applyBatchPayload(response.batch, response.drafts);
        },
        error: () => {
          if (!silent) {
            this.setActionError('No se pudo cargar el lote.');
          }
        }
      });
  }

  private applyBatchPayload(batch: IntakeBatch, drafts: IntakeDraft[]): void {
    this.batch = batch;
    this.drafts = drafts;

    const validIds = new Set(drafts.map((draft) => draft.id));
    Array.from(this.draftEditors.keys()).forEach((id) => {
      if (!validIds.has(id)) {
        this.draftEditors.delete(id);
      }
    });

    drafts.forEach((draft) => {
      const existing = this.draftEditors.get(draft.id);
      this.draftEditors.set(draft.id, this.mergeEditorState(draft, existing));
    });

    this.syncSelectedDraft();
  }

  private replaceDraft(updated: IntakeDraft): void {
    const index = this.drafts.findIndex((draft) => draft.id === updated.id);
    if (index < 0) {
      return;
    }

    const next = [...this.drafts];
    next[index] = updated;
    this.drafts = next;
    this.draftEditors.set(updated.id, this.mergeEditorState(updated, this.draftEditors.get(updated.id)));
    this.syncSelectedDraft();
  }

  private syncSelectedDraft(): void {
    if (this.selectedDraftId && this.drafts.some((draft) => draft.id === this.selectedDraftId)) {
      return;
    }

    if (this.detailPanelClosedManually) {
      this.selectedDraftId = null;
      return;
    }

    const byPriority = ['error', 'processed', 'new', 'saved'] as IntakeUiStatus[];
    for (const status of byPriority) {
      const candidate = this.draftsByUiStatus(status)[0];
      if (candidate) {
        this.selectedDraftId = candidate.id;
        return;
      }
    }

    this.selectedDraftId = null;
  }

  private startAutoRefresh(batchId: string): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    this.autoRefreshBatchId = batchId;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.scheduleNextAutoRefresh();
  }

  private stopAutoRefresh(): void {
    this.autoRefreshBatchId = null;
    if (!this.refreshTimer) {
      return;
    }
    clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private setActionError(message: string): void {
    this.errorMessage = message;
    this.notificationService.error(message);
  }

  private createEditorState(draft: IntakeDraft): DraftEditorState {
    return {
      name: draft.name || '',
      description: draft.description || '',
      tagsText: (draft.tags || []).join(', '),
      aliasesText: (draft.aliases || []).join(', '),
      dirtyFields: this.createDirtyFieldState()
    };
  }

  private mergeEditorState(draft: IntakeDraft, existing?: DraftEditorState): DraftEditorState {
    const serverState = this.createEditorState(draft);
    if (!existing) {
      return serverState;
    }

    const dirtyFields = this.createDirtyFieldState();
    const mergedState = {
      ...serverState,
      dirtyFields
    };

    (Object.keys(serverState.dirtyFields) as DraftEditorField[]).forEach((field) => {
      const serverValue = serverState[field];
      const currentValue = existing[field];
      const keepLocalValue = existing.dirtyFields[field] && currentValue !== serverValue;

      mergedState[field] = keepLocalValue ? currentValue : serverValue;
      dirtyFields[field] = keepLocalValue;
    });

    return mergedState;
  }

  private createDirtyFieldState(): Record<DraftEditorField, boolean> {
    return {
      name: false,
      description: false,
      tagsText: false,
      aliasesText: false
    };
  }

  private serverValueForField(draft: IntakeDraft, field: DraftEditorField): string {
    if (field === 'name') {
      return draft.name || '';
    }
    if (field === 'description') {
      return draft.description || '';
    }
    if (field === 'tagsText') {
      return (draft.tags || []).join(', ');
    }
    return (draft.aliases || []).join(', ');
  }

  private scheduleNextAutoRefresh(): void {
    if (!this.autoRefreshBatchId || !this.selectedWarehouseId || this.refreshTimer || this.batchLoadInFlight) {
      return;
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      if (!this.autoRefreshBatchId) {
        return;
      }
      this.loadBatch(this.autoRefreshBatchId, true);
    }, AUTO_REFRESH_INTERVAL_MS);
  }

  private finishBatchLoad(): void {
    this.batchLoadInFlight = false;
    this.activeLoadSub = undefined;

    const pendingLoad = this.pendingLoad;
    this.pendingLoad = null;

    if (pendingLoad) {
      this.loadBatch(pendingLoad.batchId, pendingLoad.silent);
      return;
    }

    this.scheduleNextAutoRefresh();
  }

  private cancelActiveLoad(): void {
    this.pendingLoad = null;
    this.batchLoadInFlight = false;
    this.activeLoadSub?.unsubscribe();
    this.activeLoadSub = undefined;
  }

  private isCameraSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  private async openCameraOverlay(): Promise<void> {
    this.cameraOverlayOpen = true;
    this.cameraErrorMessage = '';
    this.cameraLoading = true;

    try {
      if (!this.cameraStream) {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }
          },
          audio: false
        });
      }
      setTimeout(() => this.attachCameraStream(), 0);
    } catch {
      this.cameraOverlayOpen = false;
      this.cameraLoading = false;
      this.cameraErrorMessage = 'No se pudo abrir la cámara del dispositivo. Se abrirá el selector de archivos.';
      this.notificationService.info(this.cameraErrorMessage);
      this.openPicker();
    }
  }

  private attachCameraStream(): void {
    const video = this.cameraVideo?.nativeElement;
    if (!video || !this.cameraStream) {
      this.cameraLoading = false;
      return;
    }
    video.srcObject = this.cameraStream;
    video
      .play()
      .then(() => {
        this.cameraStreamActive = true;
        this.cameraLoading = false;
      })
      .catch(() => {
        this.cameraLoading = false;
        this.cameraStreamActive = false;
        this.cameraErrorMessage = 'La cámara se abrió, pero no se pudo iniciar la vista previa.';
      });
  }

  private stopCameraStream(): void {
    if (!this.cameraStream) {
      this.cameraStreamActive = false;
      return;
    }
    for (const track of this.cameraStream.getTracks()) {
      track.stop();
    }
    this.cameraStream = null;
    this.cameraStreamActive = false;
    const video = this.cameraVideo?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
  }

  private clearCapturedPreview(): void {
    if (this.capturedPreviewUrl) {
      URL.revokeObjectURL(this.capturedPreviewUrl);
    }
    this.capturedPreviewUrl = null;
  }

  private enqueueFiles(files: File[]): void {
    if (!files.length) {
      return;
    }
    const entries = files.map((file, index) => ({
      id: generateUuid(),
      file,
      label: file.name || `captura-${Date.now()}-${index + 1}`,
      status: 'queued' as const,
      errorMessage: ''
    }));
    this.captureQueue = [...this.captureQueue, ...entries];
    this.flushCaptureQueue();
  }

  private flushCaptureQueue(): void {
    if (this.uploadQueueBusy || !this.selectedWarehouseId || !this.batch) {
      return;
    }

    const nextEntry = this.captureQueue.find((entry) => entry.status === 'queued');
    if (!nextEntry) {
      return;
    }

    this.uploadQueueBusy = true;
    this.captureQueue = this.captureQueue.map((entry) =>
      entry.id === nextEntry.id ? { ...entry, status: 'uploading', errorMessage: '' } : entry
    );

    this.intakeService
      .uploadPhotos(this.selectedWarehouseId, this.batch.id, [nextEntry.file])
      .pipe(finalize(() => (this.uploadQueueBusy = false)))
      .subscribe({
        next: (response) => {
          this.captureQueue = this.captureQueue.filter((entry) => entry.id !== nextEntry.id);
          this.applyUploadResponse(response);
          this.flushCaptureQueue();
        },
        error: () => {
          this.captureQueue = this.captureQueue.map((entry) =>
            entry.id === nextEntry.id
              ? {
                  ...entry,
                  status: 'error',
                  errorMessage: 'Fallo al subir la captura. Puedes reintentarlo.'
                }
              : entry
          );
          this.notificationService.error('No se pudo subir una captura al lote.');
        }
      });
  }

  private applyUploadResponse(response: { batch: IntakeBatch; drafts: IntakeDraft[]; uploaded_count: number }): void {
    this.batch = response.batch;
    const draftById = new Map(this.drafts.map((draft) => [draft.id, draft] as const));
    for (const draft of response.drafts) {
      draftById.set(draft.id, draft);
    }
    const nextDrafts = Array.from(draftById.values()).sort((a, b) => a.position - b.position);
    this.applyBatchPayload(response.batch, nextDrafts);
    this.startAutoRefresh(response.batch.id);
  }

  private reprocessDraft(draft: IntakeDraft, mode: 'photo' | 'name'): void {
    const warehouseId = this.selectedWarehouseId;
    if (!warehouseId || this.isDraftReadOnly(draft)) {
      return;
    }

    const editor = this.editorFor(draft);
    const normalizedName = editor.name.trim();
    if (mode === 'name' && !normalizedName) {
      this.setActionError('El artículo necesita un título para reprocesar por nombre.');
      return;
    }

    this.intakeService
      .updateDraft(warehouseId, draft.id, {
        name: normalizedName || null,
        description: editor.description.trim() || null,
        tags: splitCsv(editor.tagsText),
        aliases: splitCsv(editor.aliasesText)
      })
      .pipe(switchMap(() => this.intakeService.reprocessDraft(warehouseId, draft.id, mode)))
      .subscribe({
        next: (response) => {
          this.notificationService.info(response.message);
          if (this.batch) {
            this.loadBatch(this.batch.id, true);
          } else {
            this.batch = response.batch;
          }
          this.startAutoRefresh(response.batch.id);
        },
        error: () => {
          this.setActionError('No se pudo iniciar el reprocesado del artículo.');
        }
      });
  }
}

function splitCsv(raw: string | null | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part, index, arr) => !!part && arr.indexOf(part) === index);
}
