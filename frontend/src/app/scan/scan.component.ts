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

import { BoxService } from '../services/box.service';
import { NotificationService } from '../services/notification.service';
import { WarehouseService } from '../services/warehouse.service';

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule
  ],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Escáner QR</h1>
          <p class="page-subtitle">Escanea con cámara o abre la caja manualmente por código</p>
        </div>
      </header>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="scanning" mode="indeterminate" />
        <mat-card-content>
          <p class="status-line">
            Si el navegador soporta escaneo nativo, activa cámara. Si no, escribe el código de la caja. El token QR también sigue funcionando.
          </p>

          <div class="actions-mobile-full mt-10">
            <button mat-flat-button color="primary" type="button" (click)="startCameraScan()" [disabled]="scanning">
              <mat-icon>videocam</mat-icon>
              Iniciar cámara
            </button>
            <button mat-stroked-button type="button" (click)="stopCameraScan()" [disabled]="!scanning">
              <mat-icon>videocam_off</mat-icon>
              Detener
            </button>
          </div>

          <div class="item-card media-panel mt-12">
            <video #videoEl autoplay playsinline muted class="media-frame scan-video"></video>
          </div>

          <div class="form-row mt-14">
            <mat-form-field class="grow">
              <mat-label>Código de caja o token QR</mat-label>
              <mat-icon matPrefix>qr_code_2</mat-icon>
              <input matInput [(ngModel)]="manualIdentifier" />
            </mat-form-field>
            <div class="inline-actions">
              <button mat-flat-button color="primary" type="button" (click)="resolveManualIdentifier()" [disabled]="!manualIdentifier.trim()">
                Abrir caja
              </button>
            </div>
          </div>

          <div class="error mt-10" *ngIf="errorMessage">{{ errorMessage }}</div>
          <div class="status-message mt-10" *ngIf="statusMessage">{{ statusMessage }}</div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .scan-video {
        max-width: 560px;
        max-height: min(58vh, 460px);
        object-fit: cover;
        background: #0f172a;
      }
    `
  ]
})
export class ScanComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;

  manualIdentifier = '';
  scanning = false;
  errorMessage = '';
  statusMessage = '';

  private mediaStream: MediaStream | null = null;
  private scanTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly boxService: BoxService,
    private readonly warehouseService: WarehouseService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    const routeIdentifier = this.route.snapshot.paramMap.get('qrToken') || this.route.snapshot.queryParamMap.get('token');
    if (routeIdentifier) {
      this.manualIdentifier = routeIdentifier;
      this.resolveIdentifier(routeIdentifier);
    }
  }

  ngOnDestroy(): void {
    this.stopCameraScan();
  }

  async startCameraScan(): Promise<void> {
    this.errorMessage = '';
    this.statusMessage = '';

    const video = this.videoEl?.nativeElement || null;
    if (!video) {
      this.setActionError('No se pudo inicializar el video.');
      return;
    }

    const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (config: { formats: string[] }) => BarcodeDetectorLike })
      .BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      this.setActionError('Este navegador no soporta BarcodeDetector. Usa el código manual.');
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      video.srcObject = this.mediaStream;
      this.scanning = true;
      this.statusMessage = 'Escaneando...';

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      this.scanTimer = setInterval(async () => {
        if (!this.scanning) {
          return;
        }
        try {
          const results = await detector.detect(video);
          const token = results.find((r) => !!r.rawValue)?.rawValue?.trim();
          if (token) {
            this.manualIdentifier = token;
            this.stopCameraScan();
            this.resolveIdentifier(token);
          }
        } catch {
          // keep scanning silently
        }
      }, 700);
    } catch {
      this.setActionError('No se pudo acceder a la cámara. Revisa permisos del navegador.');
    }
  }

  stopCameraScan(): void {
    this.scanning = false;
    this.statusMessage = '';
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    const video = this.videoEl?.nativeElement || null;
    if (video) {
      video.srcObject = null;
    }
  }

  resolveManualIdentifier(): void {
    this.resolveIdentifier(this.manualIdentifier.trim());
  }

  private resolveIdentifier(identifier: string): void {
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier) {
      return;
    }
    this.errorMessage = '';
    this.statusMessage = 'Resolviendo caja...';
    this.boxService.resolveByIdentifier(normalizedIdentifier).subscribe({
      next: (lookup) => {
        this.warehouseService.setSelectedWarehouseId(lookup.warehouse_id);
        this.statusMessage = '';
        this.notificationService.success(`Caja ${lookup.short_code} resuelta. Abriendo caja.`);
        this.router.navigateByUrl(`/app/boxes/${lookup.box_id}`);
      },
      error: (err) => {
        this.statusMessage = '';
        if (err?.status === 403) {
          this.setActionError('No tienes acceso al warehouse de esta caja.');
          return;
        }
        if (err?.status === 404) {
          this.setActionError('Código o QR no válido, o caja no encontrada.');
          return;
        }
        if (err?.status === 409) {
          this.setActionError('Ese código coincide con varias cajas accesibles. Usa el QR para abrir la correcta.');
          return;
        }
        this.setActionError('No se pudo resolver la caja.');
      }
    });
  }

  private setActionError(message: string): void {
    this.errorMessage = message;
    this.notificationService.error(message);
  }
}
