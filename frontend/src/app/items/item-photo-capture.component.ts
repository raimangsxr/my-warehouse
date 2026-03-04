import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { ItemService } from '../services/item.service';
import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-item-photo-capture',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
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
            <button mat-stroked-button type="button" [routerLink]="cancelRouterLink" [disabled]="analyzing">Cancelar</button>
          </div>
          <input
            id="photo-input"
            #photoInput
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            capture="environment"
            (change)="onFileSelected($event)"
            class="sr-only-input"
          />

          <div class="item-card media-panel mt-14" *ngIf="previewUrl">
            <img [src]="previewUrl" alt="Vista previa" class="media-preview" />
          </div>

          <div class="actions-mobile-full mt-12" *ngIf="previewUrl">
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
export class ItemPhotoCaptureComponent implements OnInit, OnDestroy {
  @ViewChild('photoInput') photoInput?: ElementRef<HTMLInputElement>;

  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();

  previewUrl: string | null = null;
  analyzing = false;
  errorMessage = '';
  statusMessage = '';
  targetBoxId: string | null = null;
  lockBoxSelection = false;
  cancelRouterLink: string[] = ['/app/home'];

  private selectedFile: File | null = null;

  constructor(
    private readonly itemService: ItemService,
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
  }

  ngOnDestroy(): void {
    this.releasePreviewUrl();
  }

  openPicker(): void {
    this.photoInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    this.errorMessage = '';
    this.statusMessage = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'].includes(file.type)) {
      this.errorMessage = 'Formato no soportado. Usa PNG, JPG, WEBP o HEIC.';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.errorMessage = 'La imagen es demasiado grande. Máximo 10MB.';
      return;
    }

    this.selectedFile = file;
    this.releasePreviewUrl();
    this.previewUrl = URL.createObjectURL(file);
  }

  analyzePhoto(): void {
    if (!this.selectedWarehouseId || !this.selectedFile || this.analyzing) {
      return;
    }

    this.analyzing = true;
    this.errorMessage = '';
    this.statusMessage = 'Subiendo imagen...';
    this.itemService.uploadPhoto(this.selectedWarehouseId, this.selectedFile).subscribe({
      next: (uploaded) => {
        this.statusMessage = 'Analizando imagen...';
        this.readFileAsDataUrl(this.selectedFile!)
          .then((imageDataUrl) => {
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
                  .catch(() => {
                    this.errorMessage = 'No se pudo abrir el formulario con el borrador generado.';
                  });
              },
              error: () => {
                this.analyzing = false;
                this.statusMessage = '';
                this.errorMessage = 'La imagen se subió, pero falló el análisis IA. Puedes completar el alta manualmente.';
                this.router.navigate(['/app/items/new'], {
                  queryParams: this.buildNewItemQueryParams(),
                  state: { uploadedPhotoUrl: uploaded.photo_url }
                });
              }
            });
          })
          .catch(() => {
            this.analyzing = false;
            this.statusMessage = '';
            this.errorMessage = 'No se pudo leer la imagen seleccionada.';
          });
      },
      error: () => {
        this.analyzing = false;
        this.statusMessage = '';
        this.errorMessage = 'No se pudo subir la imagen. Intenta de nuevo.';
      }
    });
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

  private releasePreviewUrl(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }
}
