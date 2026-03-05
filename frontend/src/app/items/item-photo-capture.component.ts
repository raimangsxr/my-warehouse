import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { ItemService } from '../services/item.service';
import { ItemPhotoCaptureStateService } from '../services/item-photo-capture-state.service';
import { WarehouseService } from '../services/warehouse.service';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]);
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);

@Component({
  selector: 'app-item-photo-capture',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Añadir artículo por foto</h1>
          <p class="page-subtitle">Haz una foto o sube una imagen para pre-rellenar el alta con IA</p>
        </div>
      </header>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="analyzing" mode="indeterminate" />
        <mat-card-content>
          <p class="status-line">
            La foto se usa para identificar el artículo y completar nombre, descripción, tags y aliases.
          </p>
          <p class="status-line" *ngIf="targetBoxId && lockBoxSelection">
            Alta contextual activa: la caja quedará fijada a la caja actual del detalle.
          </p>

          <div class="actions-mobile-full mt-12">
            <button mat-flat-button color="primary" type="button" [disabled]="analyzing" (click)="openPicker()">
              <mat-icon>photo_camera</mat-icon>
              Sacar/Subir foto
            </button>
            <button mat-stroked-button type="button" (click)="cancel()" [disabled]="analyzing">Cancelar</button>
          </div>
          <input
            id="photo-input"
            #photoInput
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.heic,.heif"
            capture="environment"
            (change)="onFileSelected($event)"
            class="sr-only-input"
          />

          <div class="item-card media-panel mt-14" *ngIf="hasSelectedFile">
            <img
              *ngIf="previewUrl"
              [src]="previewUrl"
              alt="Vista previa"
              class="media-preview"
              (load)="onPreviewLoadSuccess()"
              (error)="onPreviewLoadError()"
            />
            <p class="status-line" *ngIf="!previewUrl && !previewLoadFailed">Preparando previsualización...</p>
            <p class="status-line" *ngIf="previewLoadFailed">
              No se pudo mostrar la previsualización en este dispositivo, pero puedes continuar con "Analizar foto".
            </p>
            <p class="status-line" *ngIf="selectedFileLabel">Archivo seleccionado: {{ selectedFileLabel }}</p>
          </div>

          <div class="actions-mobile-full mt-12" *ngIf="hasSelectedFile">
            <button mat-flat-button color="primary" type="button" (click)="analyzePhoto()" [disabled]="analyzing">
              <mat-icon>auto_awesome</mat-icon>
              Analizar foto
            </button>
          </div>

          <div class="error mt-10" *ngIf="errorMessage">{{ errorMessage }}</div>
          <div class="status-message mt-10" *ngIf="statusMessage">{{ statusMessage }}</div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .sr-only-input {
        display: none;
      }
    `
  ]
})
export class ItemPhotoCaptureComponent implements OnInit {
  @ViewChild('photoInput') photoInput?: ElementRef<HTMLInputElement>;

  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();

  previewUrl: string | null = null;
  previewLoadFailed = false;
  analyzing = false;
  errorMessage = '';
  statusMessage = '';
  targetBoxId: string | null = null;
  lockBoxSelection = false;
  cancelRouterLink: string[] = ['/app/home'];
  selectedFileLabel = '';

  private selectedFile: File | null = null;
  private selectedFileDataUrl: string | null = null;
  private previewLoadRequestId = 0;

  constructor(
    private readonly itemService: ItemService,
    private readonly photoCaptureState: ItemPhotoCaptureStateService,
    private readonly warehouseService: WarehouseService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const queryBoxId = this.route.snapshot.queryParamMap.get('boxId');
    const lockBox = this.route.snapshot.queryParamMap.get('lockBox');

    this.targetBoxId = queryBoxId;
    this.lockBoxSelection = lockBox === '1' || lockBox === 'true';

    if (this.targetBoxId) {
      this.cancelRouterLink = ['/app/boxes', this.targetBoxId];
    }

    this.restoreCachedSelection();
  }

  openPicker(): void {
    const input = this.photoInput?.nativeElement;
    if (!input) {
      return;
    }
    // Allow selecting the same photo repeatedly and avoid stale selection edge cases on mobile browsers.
    input.value = '';
    input.click();
  }

  cancel(): void {
    this.photoCaptureState.clear();
    this.router.navigate(this.cancelRouterLink).catch(() => {
      this.setActionError('No se pudo salir de la vista de foto.');
    });
  }

  onFileSelected(event: Event): void {
    this.errorMessage = '';
    this.statusMessage = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const validationError = this.validateSelectedImage(file);
    if (validationError) {
      this.setActionError(validationError);
      return;
    }

    this.selectedFile = file;
    this.selectedFileLabel = file.name || 'captura';
    this.selectedFileDataUrl = null;
    this.previewLoadFailed = false;
    this.previewUrl = null;
    this.photoCaptureState.saveSelection({ file, fileLabel: this.selectedFileLabel });
    const requestId = ++this.previewLoadRequestId;
    this.readFileAsDataUrl(file)
      .then((dataUrl) => {
        if (requestId !== this.previewLoadRequestId || this.selectedFile !== file) {
          return;
        }
        this.selectedFileDataUrl = dataUrl;
        this.previewUrl = dataUrl;
        this.photoCaptureState.saveSelection({
          file,
          fileLabel: this.selectedFileLabel,
          dataUrl,
          previewLoadFailed: false
        });
      })
      .catch(() => {
        if (requestId !== this.previewLoadRequestId || this.selectedFile !== file) {
          return;
        }
        this.selectedFileDataUrl = null;
        this.previewUrl = null;
        this.previewLoadFailed = true;
        this.photoCaptureState.saveSelection({
          file,
          fileLabel: this.selectedFileLabel,
          dataUrl: null,
          previewLoadFailed: true
        });
        this.setActionError('No se pudo preparar la previsualización local de la imagen.');
      });
  }

  analyzePhoto(): void {
    if (this.analyzing) {
      return;
    }
    if (!this.selectedWarehouseId) {
      this.setActionError('Selecciona un almacén antes de analizar la foto.');
      return;
    }

    const file = this.selectedFile;
    if (!file) {
      this.setActionError('Selecciona una imagen antes de analizar.');
      return;
    }

    this.analyzing = true;
    this.errorMessage = '';
    this.statusMessage = 'Subiendo imagen...';
    this.itemService.uploadPhoto(this.selectedWarehouseId, file).subscribe({
      next: (uploaded) => {
        this.statusMessage = 'Analizando imagen...';
        const imageDataUrlPromise = this.selectedFileDataUrl
          ? Promise.resolve(this.selectedFileDataUrl)
          : this.readFileAsDataUrl(file);
        imageDataUrlPromise
          .then((imageDataUrl) => {
            this.selectedFileDataUrl = imageDataUrl;
            this.itemService.draftFromPhoto(this.selectedWarehouseId!, imageDataUrl).subscribe({
              next: (draft) => {
                this.analyzing = false;
                this.statusMessage = '';
                this.router
                  .navigate(['/app/items/new'], {
                    queryParams: this.buildNewItemQueryParams(),
                    state: {
                      photoDraft: draft,
                      uploadedPhotoUrl: uploaded.photo_url
                    }
                  })
                  .then((navigated) => {
                    if (navigated) {
                      this.photoCaptureState.clear();
                    }
                  })
                  .catch(() => {
                    this.setActionError('No se pudo abrir el formulario con el borrador generado.');
                  });
              },
              error: () => {
                this.analyzing = false;
                this.statusMessage = '';
                this.setActionError('La imagen se subió, pero falló el análisis IA. Puedes completar el alta manualmente.');
                this.router
                  .navigate(['/app/items/new'], {
                    queryParams: this.buildNewItemQueryParams(),
                    state: { uploadedPhotoUrl: uploaded.photo_url }
                  })
                  .then((navigated) => {
                    if (navigated) {
                      this.photoCaptureState.clear();
                    }
                  })
                  .catch(() => {
                    this.setActionError('No se pudo abrir el formulario manual después del fallo de análisis.');
                  });
              }
            });
          })
          .catch(() => {
            this.analyzing = false;
            this.statusMessage = '';
            this.setActionError('No se pudo leer la imagen seleccionada.');
          });
      },
      error: () => {
        this.analyzing = false;
        this.statusMessage = '';
        this.setActionError('No se pudo subir la imagen. Intenta de nuevo.');
      }
    });
  }

  get hasSelectedFile(): boolean {
    return !!this.selectedFile;
  }

  onPreviewLoadSuccess(): void {
    this.previewLoadFailed = false;
    this.photoCaptureState.markPreviewFailure(false);
  }

  onPreviewLoadError(): void {
    if (this.previewLoadFailed) {
      return;
    }
    this.previewLoadFailed = true;
    this.photoCaptureState.markPreviewFailure(true);
    this.setActionError('La foto se ha seleccionado, pero este navegador no puede mostrar su previsualización.');
  }

  private buildNewItemQueryParams(): { boxId?: string; lockBox?: number } | undefined {
    const params: { boxId?: string; lockBox?: number } = {};
    if (this.targetBoxId) {
      params.boxId = this.targetBoxId;
    }
    if (this.lockBoxSelection) {
      params.lockBox = 1;
    }
    return Object.keys(params).length > 0 ? params : undefined;
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Invalid reader result'));
      };
      reader.onerror = () => reject(reader.error || new Error('File read error'));
      reader.readAsDataURL(file);
    });
  }

  private validateSelectedImage(file: File): string | null {
    if (!this.isSupportedImageFile(file)) {
      return 'Formato no soportado. Usa PNG, JPG, WEBP, HEIC o HEIF.';
    }
    if (file.size <= 0) {
      return 'La imagen seleccionada está vacía. Repite la captura.';
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return 'La imagen es demasiado grande. Máximo 10MB.';
    }
    return null;
  }

  private isSupportedImageFile(file: File): boolean {
    const normalizedType = (file.type || '').toLowerCase();
    if (SUPPORTED_IMAGE_TYPES.has(normalizedType)) {
      return true;
    }
    if (normalizedType && normalizedType !== 'application/octet-stream') {
      return false;
    }

    const extension = this.getFileExtension(file.name);
    return !!extension && SUPPORTED_IMAGE_EXTENSIONS.has(extension);
  }

  private getFileExtension(fileName: string): string | null {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === fileName.length - 1) {
      return null;
    }
    return fileName.slice(lastDot + 1).toLowerCase();
  }

  private setActionError(message: string): void {
    this.errorMessage = message;
  }

  private restoreCachedSelection(): void {
    const snapshot = this.photoCaptureState.getSnapshot();
    if (!snapshot) {
      return;
    }

    this.selectedFile = snapshot.file;
    this.selectedFileLabel = snapshot.fileLabel;
    this.selectedFileDataUrl = snapshot.dataUrl;
    this.previewLoadFailed = snapshot.previewLoadFailed;
    this.previewUrl = snapshot.dataUrl;

    if (this.selectedFile && !this.previewUrl && !this.previewLoadFailed) {
      const requestId = ++this.previewLoadRequestId;
      const file = this.selectedFile;
      this.readFileAsDataUrl(file)
        .then((dataUrl) => {
          if (requestId !== this.previewLoadRequestId || this.selectedFile !== file) {
            return;
          }
          this.selectedFileDataUrl = dataUrl;
          this.previewUrl = dataUrl;
          this.photoCaptureState.saveSelection({
            file,
            fileLabel: this.selectedFileLabel,
            dataUrl,
            previewLoadFailed: false
          });
        })
        .catch(() => {
          if (requestId !== this.previewLoadRequestId || this.selectedFile !== file) {
            return;
          }
          this.previewLoadFailed = true;
          this.photoCaptureState.markPreviewFailure(true);
          this.setActionError('Se perdió la previsualización temporal al recargar la vista. Repite la foto.');
        });
    }
  }
}
